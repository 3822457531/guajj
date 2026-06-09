import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".m4v") return "video/x-m4v";
  return "application/octet-stream";
}

function resolveSafeUploadPath(segments: string[]): string | null {
  if (!segments.length) return null;
  if (segments.some((s) => s === ".." || s.includes("\0"))) return null;
  const abs = path.resolve(UPLOAD_ROOT, ...segments);
  const root = path.resolve(UPLOAD_ROOT);
  if (abs === root) return null;
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

function parseRangeHeader(range: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match) return null;

  let start = match[1] ? Number.parseInt(match[1], 10) : 0;
  let end = match[2] ? Number.parseInt(match[2], 10) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0) start = 0;
  if (end >= size) end = size - 1;
  if (start > end || start >= size) return null;

  return { start, end };
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path: segments } = await context.params;
  const abs = resolveSafeUploadPath(segments ?? []);
  if (!abs || !existsSync(abs)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(abs);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!st.isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const size = st.size;
  const contentType = mimeFor(abs);
  const baseHeaders = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400"
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const parsed = parseRangeHeader(rangeHeader, size);
    if (!parsed) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${size}`
        }
      });
    }

    const { start, end } = parsed;
    const chunkSize = end - start + 1;
    const stream = createReadStream(abs, { start, end });
    const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${size}`
      }
    });
  }

  const stream = createReadStream(abs);
  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(size)
    }
  });
}
