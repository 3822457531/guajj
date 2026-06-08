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
  onOpen,
  allowIndividualFetch = true
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
  size?: number;
  onOpen?: () => void;
  allowIndividualFetch?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(item.thumbUrl));
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (item.thumbUrl) {
      setLoaded(false);
      setError(false);
      setVisible(true);
    }
  }, [item.thumbUrl]);

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

  const canFetchIndividual = allowIndividualFetch && visible && !item.thumbUrl;
  const src = item.thumbUrl
    ? item.thumbUrl
    : canFetchIndividual
      ? `${proxyMediaUrl(apiBase, username, item.id, true)}${retryKey ? `&_r=${retryKey}` : ""}`
      : null;

  return (
    <div ref={ref} className="gs-media-thumb" style={{ width: size }}>
      {!src || error ? (
        <MediaSkeleton label={error ? "点击重试" : item.status === "pending" ? "加载中" : undefined} />
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
      {error && allowIndividualFetch ? (
        <button
          type="button"
          className="gs-media-thumb-retry"
          onClick={() => {
            setError(false);
            setLoaded(false);
            setRetryKey((k) => k + 1);
          }}
        >
          重试
        </button>
      ) : null}
    </div>
  );
}

export function LazyVideoPlayer({
  apiBase,
  username,
  item,
  allowIndividualFetch = true
}: {
  apiBase: string;
  username: string;
  item: ChannelMediaItem;
  allowIndividualFetch?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [prefetchStarted, setPrefetchStarted] = useState(Boolean(item.fullUrl));
  const [playReady, setPlayReady] = useState(Boolean(item.fullUrl));
  const [warming, setWarming] = useState(false);
  const [buffering, setBuffering] = useState(false);

  useEffect(() => {
    if (item.thumbUrl) {
      setPrefetchStarted(true);
    }
  }, [item.thumbUrl]);

  const poster =
    item.thumbUrl ||
    (allowIndividualFetch ? proxyMediaUrl(apiBase, username, item.id, true) : undefined);
  const videoSrc = pickSrc(apiBase, item, username, false);

  const startPrefetch = useCallback(() => {
    if (prefetchStarted) return;
    setPrefetchStarted(true);
    if (!item.fullUrl) setWarming(true);
  }, [item.fullUrl, prefetchStarted]);

  useEffect(() => {
    if (item.fullUrl) {
      setPrefetchStarted(true);
      setPlayReady(true);
      setWarming(false);
    }
  }, [item.fullUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || item.fullUrl) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          startPrefetch();
          io.disconnect();
        }
      },
      { rootMargin: "280px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [item.fullUrl, startPrefetch]);

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
    setPlaying(true);
    setBuffering(!playReady);
    const video = videoRef.current;
    if (video && playReady) {
      void video.play().catch(() => setBuffering(true));
    }
  }

  return (
    <div ref={containerRef} className="gs-media-video">
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
              <img src={poster} alt="" className="gs-media-video-cover" />
            ) : (
              <MediaSkeleton label="加载中" />
            )}
            <span className="gs-media-video-play">
              {warming && !playReady ? "准备视频…" : "▶ 点击播放"}
            </span>
            {warming && !playReady ? (
              <span className="gs-media-video-warm-spinner" aria-hidden />
            ) : null}
          </button>
        ) : null}

        {prefetchStarted ? (
          <video
            ref={videoRef}
            className={`gs-media-video-el${playing ? " is-active" : " is-preload"}`}
            controls={playing}
            playsInline
            preload="auto"
            poster={poster}
            src={videoSrc}
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
        {buffering ? " · 缓冲中…" : playing ? " · 播放中" : playReady ? " · 已就绪" : warming ? " · 准备中" : " · 封面已缓存"}
      </div>
    </div>
  );
}

export function MessageMediaGallery({
  apiBase = TG_SEARCH_API.prod,
  username,
  msg,
  allowIndividualFetch = true
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
  allowIndividualFetch?: boolean;
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
              <LazyVideoPlayer
                key={item.id}
                apiBase={apiBase}
                username={username}
                item={item}
                allowIndividualFetch={allowIndividualFetch}
              />
            ) : (
              <LazyPhotoThumb
                key={item.id}
                apiBase={apiBase}
                username={username}
                item={item}
                onOpen={() => openPhoto(item)}
                allowIndividualFetch={allowIndividualFetch}
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
