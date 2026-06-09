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

function cachedMediaUrl(apiBase: string, username: string, messageId: number) {
  const params = new URLSearchParams({
    username,
    messageId: String(messageId)
  });
  return `${apiBase}/media/cached?${params.toString()}`;
}

function warmMediaUrl(apiBase: string) {
  return `${apiBase}/media/warm`;
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
  coverUrl
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
  coverUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [cachedFullUrl, setCachedFullUrl] = useState<string | null>(item.fullUrl || null);
  const [prefetchStarted, setPrefetchStarted] = useState(Boolean(item.fullUrl));
  const [playReady, setPlayReady] = useState(Boolean(item.fullUrl));
  const [warming, setWarming] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [streamError, setStreamError] = useState(false);

  const poster = item.thumbUrl ? resolveMediaPlayUrl(item.thumbUrl) : coverUrl ? resolveMediaPlayUrl(coverUrl) : null;
  const videoSrc = cachedFullUrl
    ? resolveMediaPlayUrl(cachedFullUrl)
    : streamVideoUrl(apiBase, username, item.id);

  const requestWarm = useCallback(async () => {
    if (cachedFullUrl || item.contentType !== "VIDEO") return;
    setWarming(true);
    try {
      await fetch(warmMediaUrl(apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, messageId: item.id })
      });
    } catch {
      /* 预热失败仍可走 stream 播放 */
    }
  }, [apiBase, cachedFullUrl, item.contentType, item.id, username]);

  const startPrefetch = useCallback(() => {
    if (prefetchStarted) return;
    setPrefetchStarted(true);
    void requestWarm();
  }, [prefetchStarted, requestWarm]);

  useEffect(() => {
    if (item.fullUrl) {
      setCachedFullUrl(item.fullUrl);
      setPrefetchStarted(true);
      setPlayReady(true);
      setWarming(false);
    }
  }, [item.fullUrl]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!prefetchStarted || cachedFullUrl) return;

    let cancelled = false;
    const pollCached = async () => {
      for (let attempt = 0; attempt < 45 && !cancelled; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1500 : 2000));
        if (cancelled) break;
        try {
          const res = await fetch(cachedMediaUrl(apiBase, username, item.id), { cache: "no-store" });
          const data = (await res.json()) as { ready?: boolean; url?: string | null };
          if (data.ready && data.url) {
            setWarming(false);
            if (!playingRef.current || streamError) {
              setCachedFullUrl(resolveMediaPlayUrl(data.url));
              setPlayReady(true);
              setStreamError(false);
              setBuffering(false);
            }
            break;
          }
        } catch {
          /* 继续轮询 */
        }
      }
      if (!cancelled) setWarming(false);
    };

    void pollCached();
    return () => {
      cancelled = true;
    };
  }, [prefetchStarted, cachedFullUrl, apiBase, username, item.id, streamError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !prefetchStarted) return;

    const markReady = () => {
      setPlayReady(true);
      setWarming(false);
      setBuffering(false);
    };

    const onCanPlay = () => {
      markReady();
      if (playing) void video.play().catch(() => setBuffering(true));
    };
    const onCanPlayThrough = () => markReady();
    const onWaiting = () => {
      if (playing) setBuffering(true);
    };
    const onPlaying = () => setBuffering(false);
    const onLoadedData = () => {
      if (video.readyState >= 2) markReady();
    };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlayThrough);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadeddata", onLoadedData);

    if (video.readyState >= 3) markReady();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", onLoadedData);
    };
  }, [prefetchStarted, playing]);

  function handlePlayClick() {
    startPrefetch();
    setWarming(false);
    setPlaying(true);
    setBuffering(true);
    const video = videoRef.current;
    if (video && playReady) {
      void video.play().catch(() => setBuffering(true));
    }
  }

  return (
    <div className="gs-media-video">
      <div className="gs-media-video-stage">
        {!playing ? (
          <button
            type="button"
            className="gs-media-video-poster"
            onClick={handlePlayClick}
            onPointerEnter={startPrefetch}
            onTouchStart={startPrefetch}
          >
            {poster ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={poster} alt="" className="gs-media-video-cover" loading="eager" decoding="async" />
            ) : (
              <MediaSkeleton label="加载封面…" />
            )}
            <span className="gs-media-video-play">
              {warming && !playing ? "后台缓存…" : "▶ 点击播放"}
            </span>
            {warming && !playing ? (
              <span className="gs-media-video-warm-spinner" aria-hidden />
            ) : null}
          </button>
        ) : null}

        {prefetchStarted ? (
          <video
            ref={videoRef}
            key={`${item.id}-video`}
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
        {buffering ? " · 缓冲中…" : streamError ? " · 加载失败，重试或稍候" : playing ? " · 播放中" : playReady ? (cachedFullUrl ? " · CDN 就绪" : " · 已就绪") : warming ? " · 后台缓存" : " · 封面已缓存"}
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
