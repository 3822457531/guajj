"use client";

import { useEffect, useRef, useState } from "react";
import type { ChannelMediaItem } from "@/lib/jisou-search-types";

function proxyMediaUrl(username: string, messageId: number, thumb: boolean) {
  const params = new URLSearchParams({
    username,
    messageId: String(messageId),
    thumb: thumb ? "1" : "0"
  });
  return `/api/test/tg-search/media?${params.toString()}`;
}

function pickSrc(item: ChannelMediaItem, username: string, thumb: boolean) {
  if (thumb && item.thumbUrl) return item.thumbUrl;
  if (!thumb && item.fullUrl) return item.fullUrl;
  return proxyMediaUrl(username, item.id, thumb);
}

function MediaSkeleton({ label }: { label?: string }) {
  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 6,
        background: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "#9ca3af"
      }}
    >
      {label || "加载中"}
    </div>
  );
}

export function LazyPhotoThumb({
  username,
  item,
  size = 120
}: {
  username: string;
  item: ChannelMediaItem;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(item.thumbUrl));
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const src = visible || item.thumbUrl ? pickSrc(item, username, true) : null;

  return (
    <div ref={ref} style={{ width: size, flexShrink: 0 }}>
      {!src || error ? (
        <MediaSkeleton label={error ? "失败" : item.status === "pending" ? "待加载" : undefined} />
      ) : null}
      {src && !error ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            width: size,
            height: size,
            objectFit: "cover",
            borderRadius: 6,
            background: "#f3f4f6",
            display: loaded ? "block" : "none"
          }}
        />
      ) : null}
      {!loaded && src && !error ? <MediaSkeleton /> : null}
      <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>#{item.id}</div>
    </div>
  );
}

export function LazyVideoPlayer({ username, item }: { username: string; item: ChannelMediaItem }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const poster = item.thumbUrl || proxyMediaUrl(username, item.id, true);

  return (
    <div style={{ width: "100%", maxWidth: 320 }}>
      {!playing ? (
        <button
          type="button"
          onClick={() => {
            setPlaying(true);
            setLoading(true);
          }}
          style={{
            position: "relative",
            width: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderRadius: 6,
            overflow: "hidden"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block", background: "#111" }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.35)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700
            }}
          >
            ▶ 点击播放
          </span>
        </button>
      ) : (
        <video
          controls
          autoPlay
          playsInline
          preload="auto"
          poster={poster}
          src={pickSrc(item, username, false)}
          onLoadedData={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          style={{
            width: "100%",
            maxHeight: 220,
            borderRadius: 6,
            background: "#111",
            display: "block"
          }}
        />
      )}
      <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
        #{item.id}
        {loading ? " · 缓冲中…" : playing ? " · 已缓存至 R2 后走 CDN" : " · 封面已预缓存"}
      </div>
    </div>
  );
}

export function MessageMediaGallery({
  username,
  msg
}: {
  username: string;
  msg: {
    kind: "single" | "album";
    id: number;
    albumSize: number;
    mediaItems: ChannelMediaItem[];
    coverUrl?: string | null;
    mediaStatus?: string | null;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const visualItems = msg.mediaItems.filter(
    (m) => m.contentType === "PHOTO" || m.contentType === "VIDEO"
  );
  if (!visualItems.length) return null;

  const isAlbum = msg.kind === "album" && visualItems.length > 1;
  const showItems = isAlbum && !expanded ? visualItems.slice(0, 1) : visualItems;
  const hiddenCount = isAlbum ? visualItems.length - 1 : 0;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
        {showItems.map((item) =>
          item.contentType === "VIDEO" ? (
            <LazyVideoPlayer key={item.id} username={username} item={item} />
          ) : (
            <LazyPhotoThumb key={item.id} username={username} item={item} />
          )
        )}
        {isAlbum && !expanded && hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              width: 120,
              height: 120,
              borderRadius: 6,
              border: "1px dashed #cbd5e1",
              background: "#f8fafc",
              cursor: "pointer",
              fontSize: 13,
              color: "#475569",
              fontWeight: 600
            }}
          >
            +{hiddenCount}
            <br />
            展开相册
          </button>
        ) : null}
      </div>
      {msg.mediaStatus ? (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
          媒体状态：{msg.mediaStatus === "thumb_ready" ? "封面已缓存" : msg.mediaStatus === "partial" ? "部分已缓存" : "按需加载中"}
          {msg.coverUrl ? " · 列表缩略图走 R2/CDN" : ""}
        </div>
      ) : null}
    </div>
  );
}
