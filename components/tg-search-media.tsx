"use client";

import { useEffect, useRef, useState } from "react";
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

function pickSrc(apiBase: string, item: ChannelMediaItem, username: string, thumb: boolean) {
  if (thumb && item.thumbUrl) return item.thumbUrl;
  if (!thumb && item.fullUrl) return item.fullUrl;
  return proxyMediaUrl(apiBase, username, item.id, thumb);
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
  size = 120,
  onOpen
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
  size?: number;
  onOpen?: () => void;
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

  const src = visible || item.thumbUrl ? pickSrc(apiBase, item, username, true) : null;

  return (
    <div ref={ref} className="gs-media-thumb" style={{ width: size }}>
      {!src || error ? (
        <MediaSkeleton label={error ? "失败" : item.status === "pending" ? "待加载" : undefined} />
      ) : null}
      {src && !error ? (
        <button type="button" className="gs-media-thumb-btn" onClick={onOpen} aria-label="查看原图">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className="gs-media-img"
            style={{
              width: size,
              height: size,
              display: loaded ? "block" : "none"
            }}
          />
        </button>
      ) : null}
      {!loaded && src && !error ? <MediaSkeleton /> : null}
    </div>
  );
}

export function LazyVideoPlayer({
  apiBase,
  username,
  item
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
}) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const poster = item.thumbUrl || proxyMediaUrl(apiBase, username, item.id, true);

  return (
    <div className="gs-media-video">
      {!playing ? (
        <button
          type="button"
          className="gs-media-video-poster"
          onClick={() => {
            setPlaying(true);
            setLoading(true);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="gs-media-video-cover" />
          <span className="gs-media-video-play">▶ 点击播放</span>
        </button>
      ) : (
        <video
          controls
          autoPlay
          playsInline
          preload="auto"
          poster={poster}
          src={pickSrc(apiBase, item, username, false)}
          onLoadedData={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          className="gs-media-video-el"
        />
      )}
      <div className="gs-media-meta">
        #{item.id}
        {loading ? " · 缓冲中…" : playing ? " · 播放中" : " · 封面已缓存"}
      </div>
    </div>
  );
}

export function MessageMediaGallery({
  apiBase = TG_SEARCH_API.prod,
  username,
  msg
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
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewer, setViewer] = useState<{ urls: MediaViewerSource[]; index: number } | null>(null);

  const visualItems = msg.mediaItems.filter((m) => m.contentType === "PHOTO" || m.contentType === "VIDEO");
  if (!visualItems.length) return null;

  const photoItems = visualItems.filter((m) => m.contentType === "PHOTO");
  const viewerSources: MediaViewerSource[] = photoItems.map((item) => ({
    thumb: pickSrc(apiBase, item, username, true),
    full: pickSrc(apiBase, item, username, false)
  }));

  const isAlbum = msg.kind === "album" && visualItems.length > 1;
  const showItems = isAlbum && !expanded ? visualItems.slice(0, 1) : visualItems;
  const hiddenCount = isAlbum ? visualItems.length - 1 : 0;

  function openPhoto(item: ChannelMediaItem) {
    const photoIndex = photoItems.findIndex((p) => p.id === item.id);
    if (photoIndex < 0) return;
    setViewer({ urls: viewerSources, index: photoIndex });
  }

  return (
    <>
      <div className="gs-media-gallery">
        <div className="gs-media-row">
          {showItems.map((item) =>
            item.contentType === "VIDEO" ? (
              <LazyVideoPlayer key={item.id} apiBase={apiBase} username={username} item={item} />
            ) : (
              <LazyPhotoThumb
                key={item.id}
                apiBase={apiBase}
                username={username}
                item={item}
                onOpen={() => openPhoto(item)}
              />
            )
          )}
          {isAlbum && !expanded && hiddenCount > 0 ? (
            <button type="button" className="gs-media-album-more" onClick={() => setExpanded(true)}>
              +{hiddenCount}
              <span>展开相册</span>
            </button>
          ) : null}
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
    </>
  );
}
