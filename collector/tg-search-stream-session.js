/**
 * 同视频写穿缓存 + TG 直出：有缓存立刻吐给客户端，缺的数据从 TG 该 offset 边拉边推（不等待从 0 顺序下完）。
 */
const { withGramClient } = require("./gram-client");
const { iterVideoDownloadWithRetry } = require("./tg-search-media-stream");

const SESSIONS = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000;
const SESSION_SWEEP_MS = 60 * 1000;

function sessionKey(uname, mid) {
  return `${String(uname || "").toLowerCase()}:${Math.floor(Number(mid))}`;
}

function abortedError() {
  const err = new Error("请求已取消");
  err.code = "REQUEST_ABORTED";
  return err;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortedError();
}

class VideoStreamSession {
  constructor(key, head, chunkBytes) {
    this.key = key;
    this.head = head;
    this.chunkBytes = chunkBytes;
    this.fileSize = Math.max(0, Math.floor(Number(head.fileSize) || 0));
    /** @type {{ start: number, end: number, buf: Buffer }[]} */
    this.segments = [];
    this.refCount = 0;
    this.lastAccess = Date.now();
  }

  touch() {
    this.lastAccess = Date.now();
  }

  retain() {
    this.refCount++;
    this.touch();
  }

  release() {
    this.refCount = Math.max(0, this.refCount - 1);
    this.touch();
  }

  cachedBytes() {
    return this.segments.reduce((sum, s) => sum + s.buf.length, 0);
  }

  writeAt(offset, buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (!b.length) return;
    const start = Math.max(0, Math.floor(Number(offset) || 0));
    this.segments.push({ start, end: start + b.length - 1, buf: b });
    this.touch();
  }

  /** 从 pos 起连续可读的最大 end（含） */
  readContiguousFrom(pos, maxEnd) {
    const start = Math.max(0, Math.floor(Number(pos) || 0));
    const limit = Math.max(start, Math.floor(Number(maxEnd) || 0));
    let cursor = start;
    const parts = [];

    while (cursor <= limit) {
      const seg = this.segments.find((s) => cursor >= s.start && cursor <= s.end);
      if (!seg) break;
      const local = cursor - seg.start;
      const take = Math.min(seg.buf.length - local, limit - cursor + 1);
      if (take <= 0) break;
      parts.push(seg.buf.subarray(local, local + take));
      cursor += take;
    }

    if (!parts.length) return Buffer.alloc(0);
    return parts.length === 1 ? parts[0] : Buffer.concat(parts);
  }

  destroy() {
    this.segments = [];
  }
}

function sweepSessions() {
  const now = Date.now();
  for (const [key, session] of SESSIONS) {
    if (session.refCount > 0) continue;
    if (now - session.lastAccess < SESSION_TTL_MS) continue;
    session.destroy();
    SESSIONS.delete(key);
  }
}

if (!global.__tgStreamSessionSweep) {
  global.__tgStreamSessionSweep = setInterval(sweepSessions, SESSION_SWEEP_MS);
  if (typeof global.__tgStreamSessionSweep.unref === "function") {
    global.__tgStreamSessionSweep.unref();
  }
}

function getOrCreateSession(uname, mid, head, chunkBytes) {
  const key = sessionKey(uname, mid);
  let session = SESSIONS.get(key);
  if (!session) {
    session = new VideoStreamSession(key, head, chunkBytes);
    SESSIONS.set(key, session);
  }
  session.touch();
  return session;
}

async function streamFromTg({
  session,
  fromOffset,
  maxEnd,
  maxBytes,
  clientSignal,
  enqueue,
  onFirstChunk,
  onChunk,
  onProgress,
  opts,
  firstChunkSent
}) {
  let emitted = 0;
  let filePos = Math.max(0, Math.floor(Number(fromOffset) || 0));
  const limit = Math.max(filePos, Math.floor(Number(maxEnd) || 0));

  await withGramClient(
    async (client) => {
      const iter = iterVideoDownloadWithRetry(
        client,
        session.head.msg,
        session.head.entity,
        session.chunkBytes,
        filePos,
        clientSignal
      );

      for await (const chunk of iter) {
        throwIfAborted(clientSignal);
        let slice = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        if (filePos + slice.length - 1 > limit) {
          slice = slice.subarray(0, limit - filePos + 1);
        }
        if (emitted + slice.length > maxBytes) {
          slice = slice.subarray(0, maxBytes - emitted);
        }
        if (!slice.length) break;

        session.writeAt(filePos, slice);
        if (!firstChunkSent.value && onFirstChunk) onFirstChunk(slice.length);
        firstChunkSent.value = true;

        enqueue(slice);
        emitted += slice.length;
        filePos += slice.length;
        if (onChunk) onChunk(slice.length);
        if (onProgress) onProgress(filePos);

        if (emitted >= maxBytes) break;
        if (filePos > limit) break;
      }
    },
    { ...opts, signal: clientSignal, priority: "high", role: "stream", task: "video-stream" }
  );

  return emitted;
}

/**
 * 缓存命中即推；未命中则从 TG 该 offset 直出并写穿缓存。
 */
async function pumpSessionRange({
  session,
  rangeStart,
  rangeEnd,
  rangeLen,
  clientSignal,
  enqueue,
  onFirstChunk,
  onChunk,
  onProgress,
  opts
}) {
  const start = Math.max(0, Math.floor(Number(rangeStart) || 0));
  const end =
    rangeEnd != null
      ? Math.max(start, Math.floor(Number(rangeEnd) || 0))
      : session.fileSize > 0
        ? session.fileSize - 1
        : start + Math.max(0, Math.floor(Number(rangeLen) || 0)) - 1;
  const maxEmit = rangeLen != null ? Math.max(0, Math.floor(Number(rangeLen) || 0)) : end - start + 1;

  session.retain();
  const firstChunkSent = { value: false };
  let emitted = 0;
  let pos = start;

  try {
    while (emitted < maxEmit && pos <= end) {
      throwIfAborted(clientSignal);
      const byteLimit = Math.min(end, start + maxEmit - 1);

      const cached = session.readContiguousFrom(pos, byteLimit);
      if (cached.length > 0) {
        if (!firstChunkSent.value && onFirstChunk) onFirstChunk(cached.length);
        firstChunkSent.value = true;
        enqueue(cached);
        emitted += cached.length;
        pos += cached.length;
        if (onChunk) onChunk(cached.length);
        if (onProgress) onProgress(pos);
        continue;
      }

      const pulled = await streamFromTg({
        session,
        fromOffset: pos,
        maxEnd: byteLimit,
        maxBytes: maxEmit - emitted,
        clientSignal,
        enqueue,
        onFirstChunk,
        onChunk,
        onProgress,
        opts,
        firstChunkSent
      });

      if (pulled <= 0) break;
      emitted += pulled;
      pos += pulled;
    }

    return emitted;
  } finally {
    session.release();
  }
}

module.exports = {
  getOrCreateSession,
  pumpSessionRange,
  sessionKey
};
