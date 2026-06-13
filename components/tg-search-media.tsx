"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function resolveMediaPlayUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined" && url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }
  return url;
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
  size = 120,
  onOpen
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
  size?: number;
  onOpen?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const src = item.thumbUrl ? resolveMediaPlayUrl(item.thumbUrl) : null;

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
  const [playing, setPlaying] = useState(false);
  const [cachedFullUrl, setCachedFullUrl] = useState<string | null>(item.fullUrl || null);
  const [prefetchStarted, setPrefetchStarted] = useState(Boolean(item.fullUrl));
  const [playReady, setPlayReady] = useState(Boolean(item.fullUrl));
  const [probing, setProbing] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [playRoute, setPlayRoute] = useState<string | null>(item.fullUrl ? "R2_CDN" : null);

  const poster = item.thumbUrl ? resolveMediaPlayUrl(item.thumbUrl) : coverUrl ? resolveMediaPlayUrl(coverUrl) : null;
  const videoSrc = cachedFullUrl
    ? resolveMediaPlayUrl(cachedFullUrl)
    : streamVideoUrl(apiBase, username, item.id);

  const startPrefetch = useCallback(async () => {
    if (prefetchStarted) return;
    setPrefetchStarted(true);

    if (item.fullUrl) {
      setCachedFullUrl(resolveMediaPlayUrl(item.fullUrl));
      setPlayRoute("R2_CDN");
      setPlayReady(true);
      return;
    }

    setProbing(true);
    try {
      const res = await fetch(playInfoUrl(apiBase, username, item.id), { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        route?: string;
        playMode?: string;
        url?: string | null;
        cached?: boolean;
      };
      if (res.ok && data.ok) {
        setPlayRoute(data.route || null);
        if (data.cached && data.url) {
          setCachedFullUrl(resolveMediaPlayUrl(data.url));
        }
      }
    } catch {
      /* 探测失败仍走 stream */
    } finally {
      setProbing(false);
      setPlayReady(true);
    }
  }, [apiBase, item.fullUrl, item.id, prefetchStarted, username]);

  useEffect(() => {
    if (item.fullUrl) {
      setCachedFullUrl(item.fullUrl);
      setPrefetchStarted(true);
      setPlayReady(true);
      setPlayRoute("R2_CDN");
    }
  }, [item.fullUrl]);

  useEffect(() => {
    if (eagerPrefetch && !item.fullUrl) {
      void startPrefetch();
    }
  }, [eagerPrefetch, item.fullUrl, startPrefetch]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !prefetchStarted) return;

    const markReady = () => {
      setPlayReady(true);
      setBuffering(false);
    };

    const onCanPlay = () => {
      markReady();
      if (playing) void video.play().catch(() => setBuffering(true));
    };
    const onWaiting = () => {
      if (playing) setBuffering(true);
    };
    const onPlaying = () => setBuffering(false);

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    if (video.readyState >= 2) markReady();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, [prefetchStarted, playing, videoSrc]);

  function handlePlayClick() {
    void startPrefetch();
    setPlaying(true);
    setBuffering(true);
    const video = videoRef.current;
    if (video && playReady) {
      void video.play().catch(() => setBuffering(true));
    }
  }

  function routeLabel() {
    if (buffering) return " · 缓冲中…";
    if (streamError) return " · 加载失败";
    if (playing) return " · 播放中";
    if (probing) return " · 探测线路…";
    if (playRoute === "R2_CDN") return " · R2/CDN";
    if (playRoute === "TG_STREAM_LARGE") return " · 大文件直出";
    if (playRoute === "TG_STREAM") return " · TG直出流";
    if (playReady) return " · 已就绪";
    return " · 封面已缓存";
  }

  return (
    <div className="gs-media-video">
      <div className="gs-media-video-stage">
        {!playing ? (
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

        {prefetchStarted ? (
          <video
            ref={videoRef}
            key={`${item.id}-${cachedFullUrl ? "cdn" : "stream"}`}
            className={`gs-media-video-el${playing ? " is-active" : " is-preload"}`}
            controls={playing}
            playsInline
            preload="auto"
            {...(poster ? { poster } : {})}
            src={videoSrc}
            onError={() => {
              setStreamError(true);
              setBuffering(false);
            }}
          />
        ) : null}

        {playing && buffering ? (
          <div className="gs-media-video-buffering" aria-live="polite">
            <span className="gs-media-video-warm-spinner" aria-hidden />
            <span>缓冲中…</span>
          </div>
        ) : null}
      </div>
      <div className="gs-media-meta">
        #{item.id}
        {routeLabel()}
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
  const [expanded, setExpanded] = useState(false);
  const [viewer, setViewer] = useState<{ urls: MediaViewerSource[]; index: number } | null>(null);

  const visualItems = msg.mediaItems.filter((m) => m.contentType === "PHOTO" || m.contentType === "VIDEO");
  if (!visualItems.length) return null;

  const photoItems = visualItems.filter((m) => m.contentType === "PHOTO");
  const viewerSources: MediaViewerSource[] = photoItems.map((item) => ({
    thumb: pickSrc(apiBase, item, username, true) || "",
    full: pickSrc(apiBase, item, username, false) || ""
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
              <LazyVideoPlayer
                key={`${item.id}-${item.thumbUrl || msg.coverUrl || "pending"}`}
                apiBase={apiBase}
                username={username}
                item={item}
                coverUrl={msg.coverUrl}
                eagerPrefetch={eagerPrefetch}
              />
            ) : (
              <LazyPhotoThumb
                key={`${item.id}-${item.thumbUrl || "pending"}`}
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
