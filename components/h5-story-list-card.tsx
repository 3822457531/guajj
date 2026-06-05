"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HomeListTile } from "@/lib/home-post-media";
import { videoSrcForListThumbnail, videoSrcForPlayback } from "@/lib/video-tile-preview";

function tileKey(postId: string, index: number, tile: HomeListTile) {
  return `${postId}-${index}-${tile.kind}-${tile.url}`;
}

function collageClass(n: number): string {
  if (n <= 1) return "h5-story-collage h5-story-collage--1";
  if (n === 2) return "h5-story-collage h5-story-collage--2";
  if (n === 3) return "h5-story-collage h5-story-collage--3";
  if (n === 4) return "h5-story-collage h5-story-collage--4";
  return "h5-story-collage h5-story-collage--n";
}

export function H5StoryListCard({
  postId,
  href,
  title,
  summary,
  categoryName,
  timeLabel,
  tiles,
  tagToneClass
}: {
  postId: string;
  href: string;
  title: string;
  summary: string;
  categoryName: string;
  timeLabel: string;
  tiles: HomeListTile[];
  tagToneClass: string;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openAt = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  const goPrev = useCallback(() => {
    setViewerIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setViewerIndex((i) => (i < tiles.length - 1 ? i + 1 : i));
  }, [tiles.length]);

  useEffect(() => {
    if (!viewerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [viewerOpen, closeViewer, goPrev, goNext]);

  const current = tiles[viewerIndex];
  const n = tiles.length;
  const showCollage = n > 0;

  return (
    <div className="h5-story-card">
      <Link href={href} prefetch={false} className="h5-story-body">
        <div className="h5-story-meta">
          <span className={`h5-rank-tag ${tagToneClass}`}>{categoryName}</span>
          <span>{timeLabel}</span>
        </div>
        <h3 className="h5-story-heading">{title}</h3>
        <p className="h5-story-sum">{summary}</p>
      </Link>

      {showCollage ? (
        <div className={collageClass(n)}>
          {tiles.map((tile, index) => (
            <button
              key={tileKey(postId, index, tile)}
              type="button"
              className="h5-story-tile"
              onClick={() => openAt(index)}
              aria-label={tile.kind === "video" ? "播放视频" : "查看大图"}
            >
              {tile.kind === "video" ? (
                <>
                  <video
                    className="h5-story-tile-media h5-story-tile-video"
                    src={videoSrcForListThumbnail(tile.url)}
                    poster={tile.poster?.trim() ? tile.poster : undefined}
                    muted
                    playsInline
                    preload="metadata"
                    disablePictureInPicture
                    tabIndex={-1}
                    aria-hidden
                  />
                  <span className="h5-story-tile-play" aria-hidden>
                    ▶
                  </span>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={tile.url} alt="" className="h5-story-tile-media" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      ) : null}

      {viewerOpen && current ? (
        <div className="h5-media-viewer" role="dialog" aria-modal="true" aria-label="媒体预览">
          <button type="button" className="h5-media-viewer-backdrop" onClick={closeViewer} aria-label="关闭" />
          {tiles.length > 1 ? (
            <button type="button" className="h5-media-viewer-nav h5-media-viewer-prev" disabled={viewerIndex <= 0} onClick={goPrev} aria-label="上一项">
              ‹
            </button>
          ) : null}
          {tiles.length > 1 ? (
            <button
              type="button"
              className="h5-media-viewer-nav h5-media-viewer-next"
              disabled={viewerIndex >= tiles.length - 1}
              onClick={goNext}
              aria-label="下一项"
            >
              ›
            </button>
          ) : null}
          <div className="h5-media-viewer-panel">
            <button type="button" className="h5-media-viewer-close" onClick={closeViewer} aria-label="关闭">
              ✕
            </button>
            <div className="h5-media-viewer-stage">
              {current.kind === "video" ? (
                <video
                  key={current.url}
                  className="h5-media-viewer-video"
                  src={videoSrcForPlayback(current.url)}
                  poster={current.poster?.trim() ? current.poster : undefined}
                  controls
                  playsInline
                  autoPlay
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={current.url} alt="" className="h5-media-viewer-img" />
              )}
            </div>
            <Link href={href} prefetch={false} className="h5-media-viewer-postlink">
              查看全文
            </Link>
            {tiles.length > 1 ? (
              <div className="h5-media-viewer-counter">
                {viewerIndex + 1} / {tiles.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
