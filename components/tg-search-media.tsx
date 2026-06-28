"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { H5MediaViewer, type MediaViewerSource } from "@/components/h5-media-viewer";
import type { ChannelMediaItem } from "@/lib/jisou-search-types";
import { TG_SEARCH_API } from "@/lib/tg-search-api-paths";

function proxyMediaUrl(apiBase: string, username: string, messageId: number, thumb: boolean) {
  const params = new URLSearchParams({
    username,
    messageId: String(messageId),
    thumb: thumb ? "1" : "0"
  });
  return `${apiBase}/media?${params.toString()}`;
}

function streamVideoUrl(apiBase: string, username: string, messageId: number) {
  const params = new URLSearchParams({
    username,
    messageId: String(messageId)
  });
  return `${apiBase}/media/stream?${params.toString()}`;
}

function playInfoUrl(apiBase: string, username: string, messageId: number) {
  const params = new URLSearchParams({
    username,
    messageId: String(messageId)
  });
  return `${apiBase}/media/play-info?${params.toString()}`;
}

/** 小视频走 fetch→Blob URL，避免 prod 下 video src 直出流无法解码 moov 在尾的 MP4 */
const TG_BLOB_PLAY_MAX_BYTES = 8 * 1024 * 1024;

function shouldBlobPlayTgStream(meta: VideoPlayMeta | null, hasCachedUrl: boolean): boolean {
  if (hasCachedUrl) return false;
  if (!isTgStreamRoute(meta?.route ?? null, null)) return false;
  const size = meta?.fileSize ?? 0;
  return size > 0 && size <= TG_BLOB_PLAY_MAX_BYTES;
}

async function fetchStreamAsBlob(
  url: string,
  signal: AbortSignal,
  onProgress?: (received: number) => void
): Promise<Blob> {
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) {
    throw new Error(`stream HTTP ${res.status}`);
  }
  const mime = res.headers.get("Content-Type") || "video/mp4";
  const reader = res.body?.getReader();
  if (!reader) return res.blob();

  const chunks: BlobPart[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received);
  }
  return new Blob(chunks, { type: mime });
}

function revokeBlobUrl(ref: { current: string | null }) {
  if (ref.current) {
    URL.revokeObjectURL(ref.current);
    ref.current = null;
  }
}

/** 断开 video 对 /media/stream 的 HTTP 连接，避免关闭弹窗后仍从 TG 拉流 */
function stopVideoPlayback(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    video.pause();
    video.removeAttribute("src");
    video.load();
  } catch {
    /* ignore */
  }
}

function resolveMediaPlayUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined" && url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }
  return url;
}

type VideoPlayMeta = {
  fileSize: number | null;
  durationSec: number | null;
  route: string | null;
  playMode: string | null;
  largeFile: boolean;
};

type StreamBufferStats = {
  pct: number;
  bufferedBytes: number;
  totalBytes: number;
  remainBytes: number;
  speedBps: number;
  etaSec: number | null;
  hasBuffer: boolean;
};

function formatMediaBytes(n: number): string {
  const bytes = Math.max(0, Math.floor(Number(n) || 0));
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 紧凑流量展示，如 70m / 600m */
function formatTrafficBytes(n: number): string {
  const bytes = Math.max(0, Math.floor(Number(n) || 0));
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return kb >= 100 ? `${Math.round(kb)}k` : `${kb.toFixed(kb >= 10 ? 0 : 1)}k`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    if (mb >= 100) return `${Math.round(mb)}m`;
    if (mb >= 10) return `${Math.round(mb)}m`;
    return `${mb.toFixed(mb >= 1 ? 0 : 1)}m`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb >= 10 ? gb.toFixed(1) : gb.toFixed(2)}g`;
}

function formatTrafficPair(bufferedBytes: number, totalBytes: number): string {
  return `${formatTrafficBytes(bufferedBytes)}/${formatTrafficBytes(totalBytes)}`;
}

function formatTrafficPairDisplay(bufferedBytes: number, totalBytes: number, loading = false): string {
  if (loading && bufferedBytes <= 0 && totalBytes > 0) {
    return `···/${formatTrafficBytes(totalBytes)}`;
  }
  return formatTrafficPair(bufferedBytes, totalBytes);
}

function formatStreamSpeed(bytesPerSec: number): string {
  const bps = Math.max(0, Number(bytesPerSec) || 0);
  if (bps <= 0) return "—";
  const mbps = (bps * 8) / (1024 * 1024);
  if (mbps >= 1) return `${mbps.toFixed(2)} Mbps`;
  return `${Math.round((bps * 8) / 1024)} Kbps`;
}

function formatEta(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "";
  const s = Math.ceil(sec);
  if (s < 60) return `约 ${s} 秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `约 ${m} 分 ${r} 秒` : `约 ${m} 分钟`;
}

function sumBufferedSeconds(video: HTMLVideoElement): number {
  let bufferedSec = 0;
  for (let i = 0; i < video.buffered.length; i++) {
    bufferedSec += Math.max(0, video.buffered.end(i) - video.buffered.start(i));
  }
  return bufferedSec;
}

function maxBufferedEndSeconds(video: HTMLVideoElement): number {
  let end = 0;
  for (let i = 0; i < video.buffered.length; i++) {
    end = Math.max(end, video.buffered.end(i));
  }
  return end;
}

function isTimeBuffered(video: HTMLVideoElement, time: number): boolean {
  for (let i = 0; i < video.buffered.length; i++) {
    if (time >= video.buffered.start(i) - 0.05 && time <= video.buffered.end(i) + 0.05) {
      return true;
    }
  }
  return false;
}

/** TG 直出流允许 seek 的最远时间点（必须在已缓冲范围内，避免 Range 请求风暴） */
function getMaxSeekableTime(video: HTMLVideoElement, marginSec = 1): number {
  if (video.buffered.length === 0) return 0;
  const maxEnd = maxBufferedEndSeconds(video);
  return Math.max(0, maxEnd - marginSec);
}

function clampVideoSeekToBuffer(video: HTMLVideoElement, marginSec = 1): boolean {
  const maxSeek = getMaxSeekableTime(video, marginSec);
  if (video.currentTime > maxSeek + 0.05) {
    video.currentTime = maxSeek;
    return true;
  }
  return false;
}

/** 估算已下载字节（累计高水位，seek 后不回退） */
function estimateDownloadedBytes(
  video: HTMLVideoElement,
  fileSize: number | null,
  durationHint: number | null,
  previousPeak: number
): number {
  const base = readVideoBufferStats(video, fileSize, durationHint);
  const duration =
    Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationHint || 0;
  const totalBytes = fileSize && fileSize > 0 ? fileSize : 0;
  let estimate = base.bufferedBytes;

  if (duration > 0 && totalBytes > 0) {
    const maxEnd = maxBufferedEndSeconds(video);
    if (maxEnd > 0) {
      estimate = Math.round(Math.min(1, maxEnd / duration) * totalBytes);
    }
  }

  return Math.max(previousPeak, estimate);
}

/** 按已缓冲数据量（非播放进度）估算字节与百分比 */
function readVideoBufferStats(
  video: HTMLVideoElement,
  fileSize: number | null,
  durationHint: number | null
): StreamBufferStats {
  const duration =
    Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationHint || 0;
  const bufferedSec = sumBufferedSeconds(video);
  const totalBytes = fileSize && fileSize > 0 ? fileSize : 0;
  let bufferedBytes = 0;
  let pct = 0;

  if (duration > 0 && totalBytes > 0) {
    const ratio = Math.min(1, bufferedSec / duration);
    bufferedBytes = Math.round(ratio * totalBytes);
    pct = Math.min(100, Math.round((bufferedBytes / totalBytes) * 100));
  } else if (duration > 0) {
    pct = Math.min(100, Math.round((bufferedSec / duration) * 100));
  }

  const remainBytes = totalBytes > 0 ? Math.max(0, totalBytes - bufferedBytes) : 0;

  return {
    pct,
    bufferedBytes,
    totalBytes,
    remainBytes,
    speedBps: 0,
    etaSec: null,
    hasBuffer: bufferedSec > 0.05 || video.readyState >= 3
  };
}

function isTgStreamRoute(route: string | null, cachedFullUrl: string | null) {
  if (cachedFullUrl) return false;
  return route === "TG_STREAM" || route === "TG_STREAM_LARGE" || !route;
}

type VideoPlaybackScope = {
  activeVideoId: number | null;
  requestPlay: (videoId: number) => void;
};

const VideoPlaybackContext = createContext<VideoPlaybackScope | null>(null);

function useVideoPlaybackScope() {
  return useContext(VideoPlaybackContext);
}

function pickSrc(apiBase: string, item: ChannelMediaItem, username: string, thumb: boolean) {
  if (thumb) return item.thumbUrl || null;
  if (item.fullUrl) return item.fullUrl;
  if (item.contentType === "VIDEO") {
    return streamVideoUrl(apiBase, username, item.id);
  }
  return proxyMediaUrl(apiBase, username, item.id, false);
}

function MediaSkeleton({ label }: { label?: string }) {
  return (
    <div className="gs-media-skeleton" aria-hidden>
      {label || "加载中"}
    </div>
  );
}

export function LazyPhotoThumb({
  apiBase,
  username,
  item,
  coverUrl,
  size = 120,
  onOpen
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
  coverUrl?: string | null;
  size?: number;
  onOpen?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const src = item.thumbUrl
    ? resolveMediaPlayUrl(item.thumbUrl)
    : coverUrl
      ? resolveMediaPlayUrl(coverUrl)
      : null;

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div className="gs-media-thumb" style={{ width: size }}>
      {!src ? (
        <MediaSkeleton label="加载封面…" />
      ) : (
        <button type="button" className="gs-media-thumb-btn" onClick={onOpen} aria-label="查看原图">
          <div className="gs-media-thumb-stage" style={{ width: size, height: size }}>
            {!loaded && !error ? <div className="gs-media-skeleton gs-media-skeleton--overlay" aria-hidden /> : null}
            {error ? (
              <MediaSkeleton label="封面失败" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={src}
                src={src}
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                className="gs-media-img"
                style={{
                  width: size,
                  height: size,
                  opacity: loaded ? 1 : 0,
                  transition: "opacity 0.2s ease"
                }}
              />
            )}
          </div>
        </button>
      )}
    </div>
  );
}

export function LazyVideoPlayer({
  apiBase,
  username,
  item,
  coverUrl,
  eagerPrefetch = false
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
  coverUrl?: string | null;
  eagerPrefetch?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const streamFetchAbortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const prefetchPromiseRef = useRef<Promise<VideoPlayMeta | null> | null>(null);
  const probingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [playAttempt, setPlayAttempt] = useState(0);
  const [cachedFullUrl, setCachedFullUrl] = useState<string | null>(item.fullUrl || null);
  const [playInfoReady, setPlayInfoReady] = useState(Boolean(item.fullUrl));
  const [playReady, setPlayReady] = useState(Boolean(item.fullUrl));
  const [probing, setProbing] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [blobPlayUrl, setBlobPlayUrl] = useState<string | null>(null);
  const [blobFetching, setBlobFetching] = useState(false);
  const [playRoute, setPlayRoute] = useState<string | null>(item.fullUrl ? "R2_CDN" : null);
  const [playMeta, setPlayMeta] = useState<VideoPlayMeta | null>(
    item.fullUrl ? { fileSize: null, durationSec: null, route: "R2_CDN", playMode: null, largeFile: false } : null
  );
  const playMetaRef = useRef<VideoPlayMeta | null>(playMeta);
  const playingRef = useRef(playing);
  const [bufferStats, setBufferStats] = useState<StreamBufferStats | null>(null);
  const [seekClampHint, setSeekClampHint] = useState(false);
  const speedSampleRef = useRef<{ at: number; bytes: number } | null>(null);
  const downloadedBytesRef = useRef(0);
  const seekGuardLockRef = useRef(false);
  const playbackScope = useVideoPlaybackScope();
  const isActivePlayback = !playbackScope || playbackScope.activeVideoId === item.id;

  const poster = item.thumbUrl ? resolveMediaPlayUrl(item.thumbUrl) : coverUrl ? resolveMediaPlayUrl(coverUrl) : null;
  const videoSrc = cachedFullUrl
    ? resolveMediaPlayUrl(cachedFullUrl)
    : streamVideoUrl(apiBase, username, item.id);
  const activeVideoSrc = blobPlayUrl ?? (blobFetching ? null : videoSrc);
  const showStreamProgress =
    playing && isTgStreamRoute(playRoute, cachedFullUrl) && !streamError && !blobPlayUrl;
  const showBlobFetchProgress = playing && blobFetching && !streamError;
  const trafficTotalBytes = bufferStats?.totalBytes || playMeta?.fileSize || 0;
  const trafficBufferedBytes = bufferStats?.bufferedBytes ?? downloadedBytesRef.current;
  const trafficBufferPct =
    trafficTotalBytes > 0
      ? Math.min(100, Math.round((trafficBufferedBytes / trafficTotalBytes) * 100))
      : bufferStats?.pct ?? 0;
  const tgStreamPlayback = isTgStreamRoute(playRoute, cachedFullUrl) && !blobPlayUrl;
  const trafficLoading = Boolean(
    playing && isActivePlayback && buffering && (showStreamProgress || showBlobFetchProgress)
  );
  const trafficPairLabel = formatTrafficPairDisplay(
    trafficBufferedBytes,
    trafficTotalBytes,
    trafficLoading
  );

  useEffect(() => {
    playMetaRef.current = playMeta;
  }, [playMeta]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const startPrefetch = useCallback(
    async (opts?: { force?: boolean }): Promise<VideoPlayMeta | null> => {
      if (item.fullUrl) {
        const meta: VideoPlayMeta = {
          fileSize: null,
          durationSec: null,
          route: "R2_CDN",
          playMode: "R2/CDN 缓存",
          largeFile: false
        };
        setCachedFullUrl(resolveMediaPlayUrl(item.fullUrl));
        setPlayRoute("R2_CDN");
        setPlayMeta(meta);
        setPlayReady(true);
        setPlayInfoReady(true);
        return meta;
      }

      if (!opts?.force && playInfoReady && playMetaRef.current?.fileSize) {
        return playMetaRef.current;
      }

      if (prefetchPromiseRef.current) {
        return prefetchPromiseRef.current;
      }

      prefetchAbortRef.current?.abort();
      const prefetchAbort = new AbortController();
      prefetchAbortRef.current = prefetchAbort;

      const task = (async (): Promise<VideoPlayMeta | null> => {
        probingRef.current = true;
        setProbing(true);
        let nextMeta: VideoPlayMeta | null = playMetaRef.current;
        try {
          const res = await fetch(playInfoUrl(apiBase, username, item.id), {
            cache: "no-store",
            signal: prefetchAbort.signal
          });
          const data = (await res.json()) as {
            ok?: boolean;
            route?: string;
            playMode?: string;
            url?: string | null;
            cached?: boolean;
            fileSize?: number | null;
            durationSec?: number | null;
            largeFile?: boolean;
          };
          if (res.ok && data.ok) {
            nextMeta = {
              fileSize: data.fileSize != null ? Number(data.fileSize) : null,
              durationSec: data.durationSec != null ? Number(data.durationSec) : null,
              route: data.route || null,
              playMode: data.playMode || null,
              largeFile: Boolean(data.largeFile)
            };
            setPlayRoute(data.route || null);
            setPlayMeta(nextMeta);
            if (data.cached && data.url && !playingRef.current) {
              setCachedFullUrl(resolveMediaPlayUrl(data.url));
            }
          }
          return nextMeta;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return playMetaRef.current;
          return playMetaRef.current;
        } finally {
          probingRef.current = false;
          setProbing(false);
          setPlayInfoReady(true);
          setPlayReady(true);
        }
      })();

      prefetchPromiseRef.current = task;
      try {
        return await task;
      } finally {
        if (prefetchPromiseRef.current === task) {
          prefetchPromiseRef.current = null;
        }
      }
    },
    [apiBase, item.fullUrl, item.id, playInfoReady, username]
  );

  useEffect(() => {
    if (!item.fullUrl) return;
    // 播放中勿因父级 prefetch 写入 fullUrl 而切源，否则会 abort TG 流
    if (playing && isTgStreamRoute(playRoute, cachedFullUrl) && !blobPlayUrl) return;
    setCachedFullUrl(resolveMediaPlayUrl(item.fullUrl));
    setPlayInfoReady(true);
    setPlayReady(true);
    setPlayRoute("R2_CDN");
    setPlayMeta({
      fileSize: null,
      durationSec: null,
      route: "R2_CDN",
      playMode: "R2/CDN 缓存",
      largeFile: false
    });
  }, [item.fullUrl, playing, playRoute, cachedFullUrl, blobPlayUrl]);

  useEffect(() => {
    if (!playbackScope) return;
    if (playbackScope.activeVideoId === item.id || !playing) return;
    streamFetchAbortRef.current?.abort();
    revokeBlobUrl(blobUrlRef);
    setBlobPlayUrl(null);
    setBlobFetching(false);
    stopVideoPlayback(videoRef.current);
    setPlaying(false);
    setBuffering(false);
  }, [playbackScope, playbackScope?.activeVideoId, item.id, playing]);

  useEffect(() => {
    speedSampleRef.current = null;
    downloadedBytesRef.current = 0;
    setBufferStats(null);
    setSeekClampHint(false);
  }, [playing, videoSrc, playAttempt]);

  useEffect(() => {
    if (playAttempt === 0) return;
    streamFetchAbortRef.current?.abort();
    revokeBlobUrl(blobUrlRef);
    setBlobPlayUrl(null);
    setBlobFetching(false);
  }, [playAttempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing || !showStreamProgress) return;

    const fileSize = playMeta?.fileSize ?? null;
    const durationHint = playMeta?.durationSec ?? null;

    function updateBufferStats() {
      const base = readVideoBufferStats(video!, fileSize, durationHint);
      const downloadedBytes = estimateDownloadedBytes(
        video!,
        fileSize,
        durationHint,
        downloadedBytesRef.current
      );
      downloadedBytesRef.current = downloadedBytes;

      const totalBytes = fileSize && fileSize > 0 ? fileSize : base.totalBytes;
      const bufferPct =
        totalBytes > 0
          ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
          : base.pct;
      const remainBytes = totalBytes > 0 ? Math.max(0, totalBytes - downloadedBytes) : 0;

      const now = Date.now();
      let speedBps = 0;
      let etaSec: number | null = null;

      if (downloadedBytes > 0) {
        const prev = speedSampleRef.current;
        if (prev && now > prev.at) {
          const deltaBytes = downloadedBytes - prev.bytes;
          const deltaSec = (now - prev.at) / 1000;
          if (deltaBytes > 0 && deltaSec > 0.2) {
            speedBps = deltaBytes / deltaSec;
          }
        }
        if (speedBps > 0) {
          speedSampleRef.current = { at: now, bytes: downloadedBytes };
        } else if (!speedSampleRef.current) {
          speedSampleRef.current = { at: now, bytes: downloadedBytes };
        }
      }

      if (speedBps > 0 && remainBytes > 0) {
        etaSec = remainBytes / speedBps;
      }

      setBufferStats({
        ...base,
        bufferedBytes: downloadedBytes,
        totalBytes,
        pct: bufferPct,
        remainBytes,
        speedBps,
        etaSec
      });
    }

    const onSeeked = () => {
      updateBufferStats();
    };

    updateBufferStats();
    video.addEventListener("progress", updateBufferStats);
    video.addEventListener("loadedmetadata", updateBufferStats);
    video.addEventListener("canplay", updateBufferStats);
    video.addEventListener("seeked", onSeeked);

    const timer = window.setInterval(updateBufferStats, 1000);

    return () => {
      video.removeEventListener("progress", updateBufferStats);
      video.removeEventListener("loadedmetadata", updateBufferStats);
      video.removeEventListener("canplay", updateBufferStats);
      video.removeEventListener("seeked", onSeeked);
      window.clearInterval(timer);
    };
  }, [playing, showStreamProgress, playMeta?.fileSize, playMeta?.durationSec]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing || !tgStreamPlayback) return;

    const seekMarginSec = playRoute === "TG_STREAM_LARGE" ? 2 : 1;
    let hintTimer: number | null = null;

    const showSeekClampHint = () => {
      setSeekClampHint(true);
      if (hintTimer) window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => setSeekClampHint(false), 3000);
    };

    const onSeeking = () => {
      if (seekGuardLockRef.current) return;
      seekGuardLockRef.current = true;
      try {
        const clamped = clampVideoSeekToBuffer(video, seekMarginSec);
        if (clamped) {
          showSeekClampHint();
        } else if (!isTimeBuffered(video, video.currentTime)) {
          setBuffering(true);
        }
      } finally {
        seekGuardLockRef.current = false;
      }
    };

    video.addEventListener("seeking", onSeeking);

    return () => {
      video.removeEventListener("seeking", onSeeking);
      if (hintTimer) window.clearTimeout(hintTimer);
    };
  }, [playing, tgStreamPlayback, playRoute, videoSrc, playAttempt]);

  useEffect(() => {
    if (eagerPrefetch && !item.fullUrl) {
      void startPrefetch();
    }
  }, [eagerPrefetch, item.fullUrl, startPrefetch]);

  useEffect(() => {
    if (!playing || !showStreamProgress || item.fullUrl || playMeta?.fileSize) return;
    void startPrefetch({ force: true });
  }, [playing, showStreamProgress, item.fullUrl, playMeta?.fileSize, startPrefetch]);

  useEffect(() => {
    if (!playing) {
      // 仅 blob 下载走 fetch AbortController；<video src> 由 stopVideoPlayback 断开
      if (blobFetching) streamFetchAbortRef.current?.abort();
      stopVideoPlayback(videoRef.current);
    }
  }, [playing, blobFetching]);

  useEffect(() => {
    return () => {
      prefetchAbortRef.current?.abort();
      prefetchAbortRef.current = null;
      streamFetchAbortRef.current?.abort();
      streamFetchAbortRef.current = null;
      revokeBlobUrl(blobUrlRef);
      stopVideoPlayback(videoRef.current);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing) return;

    const markReady = () => {
      setPlayReady(true);
      setBuffering(false);
    };

    const onCanPlay = () => {
      markReady();
      if (playing) void video.play().catch(() => setBuffering(true));
    };
    const onCanPlayThrough = () => {
      markReady();
    };
    const onLoadedMetadata = () => {
      if (video.readyState >= 1 && video.duration > 0) {
        setPlayReady(true);
      }
    };
    const onWaiting = () => {
      if (playing) setBuffering(true);
    };
    const onPlaying = () => setBuffering(false);

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlayThrough);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    if (video.readyState >= 2) markReady();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, [playing, activeVideoSrc]);

  useEffect(() => {
    if (!playing || !buffering || streamError || cachedFullUrl) return;
    const fileSize = playMeta?.fileSize ?? 0;
    const timeoutMs =
      blobFetching && fileSize > 0
        ? Math.max(120_000, Math.ceil(fileSize / (200 * 1024)) * 1000 + 30_000)
        : 90_000;
    const timer = window.setTimeout(() => {
      setStreamError(true);
      setBuffering(false);
      setBlobFetching(false);
      streamFetchAbortRef.current?.abort();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [playing, buffering, streamError, cachedFullUrl, playAttempt, blobFetching, playMeta?.fileSize]);

  async function handlePlayClick() {
    playbackScope?.requestPlay(item.id);
    setStreamError(false);
    setBufferStats(null);
    speedSampleRef.current = null;
    downloadedBytesRef.current = 0;
    streamFetchAbortRef.current?.abort();
    revokeBlobUrl(blobUrlRef);
    setBlobPlayUrl(null);
    setBlobFetching(false);

    await startPrefetch();
    if (!item.fullUrl && !playMetaRef.current?.fileSize) {
      await startPrefetch({ force: true });
    }

    const meta = playMetaRef.current;
    if (shouldBlobPlayTgStream(meta, Boolean(item.fullUrl || cachedFullUrl))) {
      setPlaying(true);
      setBuffering(true);
      setBlobFetching(true);
      const totalBytes = meta?.fileSize ?? 0;
      const ac = new AbortController();
      streamFetchAbortRef.current = ac;
      try {
        const blob = await fetchStreamAsBlob(videoSrc, ac.signal, (received) => {
          downloadedBytesRef.current = received;
          setBufferStats((prev) => ({
            pct: totalBytes > 0 ? Math.min(100, Math.round((received / totalBytes) * 100)) : 0,
            bufferedBytes: received,
            totalBytes,
            remainBytes: Math.max(0, totalBytes - received),
            speedBps: prev?.speedBps ?? 0,
            etaSec: null,
            hasBuffer: received > 0
          }));
        });
        if (ac.signal.aborted) return;
        revokeBlobUrl(blobUrlRef);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobPlayUrl(url);
        setBlobFetching(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStreamError(true);
        setBuffering(false);
        setPlaying(false);
        setBlobFetching(false);
      }
      return;
    }

    setPlaying(true);
    setBuffering(true);
  }

  function handleRetryPlay() {
    playbackScope?.requestPlay(item.id);
    setStreamError(false);
    setBufferStats(null);
    speedSampleRef.current = null;
    streamFetchAbortRef.current?.abort();
    revokeBlobUrl(blobUrlRef);
    setBlobPlayUrl(null);
    setBlobFetching(false);
    setPlaying(false);
    setBuffering(false);
    setPlayAttempt((n) => n + 1);
    window.setTimeout(() => {
      void handlePlayClick();
    }, 0);
  }

  function routeLabel() {
    if (playing && isActivePlayback && buffering) return " · 缓冲中…";
    if (streamError && isActivePlayback) return " · 加载失败";
    if (playing && isActivePlayback) return " · 播放中";
    if (probing) return " · 探测线路…";
    if (playRoute === "R2_CDN") return " · R2/CDN";
    if (playRoute === "TG_STREAM_LARGE") return " · 暗网直出流（大文件）";
    if (playRoute === "TG_STREAM") return " · 暗网直出流";
    if (playReady) return " · 已就绪";
    return " · 封面已缓存";
  }

  function streamProgressHint() {
    if (seekClampHint) return "暗网资源仅支持拖到已缓冲位置，请等待缓冲前进";
    if (blobFetching) return "正在下载完整视频（Telegram 直出）…";
    if (!showStreamProgress && !blobFetching) return null;
    if (!bufferStats?.hasBuffer && buffering) return "正在从 Telegram 拉取首包…";
    if (bufferStats && bufferStats.totalBytes > 0) {
      const eta = formatEta(bufferStats.etaSec);
      return eta ? `继续等待即可播放 · 预计还需 ${eta}` : "数据持续到达中，请稍候…";
    }
    if (bufferStats && bufferStats.pct > 0) {
      return `已缓冲约 ${bufferStats.pct}%，请继续等待…`;
    }
    return "正在建立视频流，请稍候…";
  }

  return (
    <div className="gs-media-video">
      <div className="gs-media-video-stage">
        {!playing || !isActivePlayback ? (
          <button
            type="button"
            className="gs-media-video-poster"
            onClick={handlePlayClick}
            onPointerEnter={() => void startPrefetch()}
            onTouchStart={() => void startPrefetch()}
          >
            {poster ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={poster} alt="" className="gs-media-video-cover" loading="eager" decoding="async" />
            ) : (
              <MediaSkeleton label="加载封面…" />
            )}
            <span className="gs-media-video-play">{probing ? "探测线路…" : "▶ 点击播放"}</span>
            {probing ? <span className="gs-media-video-warm-spinner" aria-hidden /> : null}
          </button>
        ) : null}

        {playing && isActivePlayback && activeVideoSrc ? (
          <video
            ref={videoRef}
            key={`${item.id}-play-${playAttempt}`}
            className={`gs-media-video-el is-active${tgStreamPlayback ? " is-tg-stream" : ""}`}
            controls
            playsInline
            preload="metadata"
            {...(poster ? { poster } : {})}
            src={activeVideoSrc}
            onError={() => {
              setStreamError(true);
              setBuffering(false);
            }}
          />
        ) : null}

        {playing && isActivePlayback && streamError ? (
          <div className="gs-media-video-buffering" aria-live="polite">
            <span>视频加载超时，请重试</span>
            {bufferStats && bufferStats.totalBytes > 0 ? (
              <span className="gs-media-video-progress-detail">
                已缓冲 {formatMediaBytes(bufferStats.bufferedBytes)} / {formatMediaBytes(bufferStats.totalBytes)}
              </span>
            ) : null}
            <button type="button" className="gs-media-video-play" onClick={handleRetryPlay}>
              重新播放
            </button>
          </div>
        ) : null}

        {playing && isActivePlayback && (buffering || (showStreamProgress && !bufferStats?.hasBuffer) || blobFetching) && !streamError ? (
          <div className="gs-media-video-buffering gs-media-video-buffering--progress" aria-live="polite">
            <span className="gs-media-video-warm-spinner" aria-hidden />
            <span>{blobFetching ? "下载中…" : buffering ? "缓冲中…" : "连接中…"}</span>
            {(showStreamProgress || showBlobFetchProgress) && (trafficTotalBytes <= 0 || seekClampHint || blobFetching) ? (
              <p className="gs-media-video-progress-hint">{streamProgressHint()}</p>
            ) : null}
          </div>
        ) : null}

        {playing && isActivePlayback && (showStreamProgress || showBlobFetchProgress) && !streamError && trafficTotalBytes > 0 ? (
          <div className="gs-media-video-progress-strip" aria-live="polite">
            <div className="gs-media-video-progress-strip-row">
              <div className="gs-media-video-progress-track gs-media-video-progress-track--strip" aria-hidden>
                <span
                  className="gs-media-video-progress-fill"
                  style={{ width: `${Math.max(trafficBufferPct, trafficBufferedBytes > 0 ? 2 : 0)}%` }}
                />
              </div>
              <span className="gs-media-video-progress-strip-size">{trafficPairLabel}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="gs-media-meta">
        #{item.id}
        {routeLabel()}
        {showStreamProgress && trafficTotalBytes > 0 && playing && isActivePlayback ? (
          <span className="gs-media-meta-progress">
            {" "}
            · {trafficPairLabel} ({trafficBufferPct}%)
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MessageMediaGallery({
  apiBase = TG_SEARCH_API.prod,
  username,
  msg,
  eagerPrefetch = false
}: {
  apiBase?: string;
  username: string;
  msg: {
    kind: "single" | "album";
    id: number;
    albumSize: number;
    mediaItems: ChannelMediaItem[];
    coverUrl?: string | null;
    mediaStatus?: string | null;
  };
  eagerPrefetch?: boolean;
}) {
  const [viewer, setViewer] = useState<{ urls: MediaViewerSource[]; index: number } | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
  const requestPlay = useCallback((videoId: number) => {
    setActiveVideoId(videoId);
  }, []);
  const playbackScope = useMemo(
    () => ({ activeVideoId, requestPlay }),
    [activeVideoId, requestPlay]
  );

  const visualItems = msg.mediaItems.filter((m) => m.contentType === "PHOTO" || m.contentType === "VIDEO");
  if (!visualItems.length) return null;

  const photoItems = visualItems.filter((m) => m.contentType === "PHOTO");
  const viewerSources: MediaViewerSource[] = photoItems.map((item) => ({
    thumb: pickSrc(apiBase, item, username, true) || "",
    full: pickSrc(apiBase, item, username, false) || ""
  }));

  function openPhoto(item: ChannelMediaItem) {
    const photoIndex = photoItems.findIndex((p) => p.id === item.id);
    if (photoIndex < 0) return;
    setViewer({ urls: viewerSources, index: photoIndex });
  }

  return (
    <VideoPlaybackContext.Provider value={playbackScope}>
      <div className="gs-media-gallery">
        <div className="gs-media-row">
          {visualItems.map((item, index) =>
            item.contentType === "VIDEO" ? (
              <LazyVideoPlayer
                key={item.id}
                apiBase={apiBase}
                username={username}
                item={item}
                coverUrl={msg.coverUrl}
                eagerPrefetch={eagerPrefetch}
              />
            ) : (
              <LazyPhotoThumb
                key={item.id}
                apiBase={apiBase}
                username={username}
                item={item}
                coverUrl={index === 0 ? msg.coverUrl : undefined}
                onOpen={() => openPhoto(item)}
              />
            )
          )}
        </div>
      </div>

      {viewer ? (
        <H5MediaViewer
          urls={viewer.urls}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
        />
      ) : null}
    </VideoPlaybackContext.Provider>
  );
}
