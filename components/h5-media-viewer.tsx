"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type MediaViewerSource = string | { thumb: string; full: string };

function resolveThumb(source: MediaViewerSource) {
  return typeof source === "string" ? source : source.thumb || source.full;
}

function resolveFull(source: MediaViewerSource) {
  return typeof source === "string" ? source : source.full || source.thumb;
}

export function H5MediaViewer({
  urls,
  index,
  onClose,
  onIndexChange,
  label = "图片预览"
}: {
  urls: MediaViewerSource[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  label?: string;
}) {
  const source = urls[index];
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const hasNav = urls.length > 1;

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index < urls.length - 1) onIndexChange(index + 1);
  }, [index, onIndexChange, urls.length]);

  useEffect(() => {
    if (!source) return;
    const thumb = resolveThumb(source);
    const full = resolveFull(source);
    let cancelled = false;

    setLoadError(false);
    setDisplayUrl(thumb || full);
    const needsFullLoad = Boolean(full && thumb && full !== thumb);
    setLoadingFull(needsFullLoad);

    if (!needsFullLoad || !full) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDisplayUrl(full);
      setLoadingFull(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      setLoadingFull(false);
      setLoadError(true);
    };
    img.src = full;

    return () => {
      cancelled = true;
    };
  }, [source, index]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, goPrev, goNext]);

  if (!source || !displayUrl) return null;

  const viewer = (
    <div className="h5-media-viewer" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="h5-media-viewer-backdrop" onClick={onClose} aria-label="关闭" />
      {hasNav ? (
        <button type="button" className="h5-media-viewer-nav h5-media-viewer-prev" disabled={index <= 0} onClick={goPrev} aria-label="上一张">
          ‹
        </button>
      ) : null}
      {hasNav ? (
        <button
          type="button"
          className="h5-media-viewer-nav h5-media-viewer-next"
          disabled={index >= urls.length - 1}
          onClick={goNext}
          aria-label="下一张"
        >
          ›
        </button>
      ) : null}
      <div className="h5-media-viewer-panel">
        <button type="button" className="h5-media-viewer-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>
        <div className="h5-media-viewer-stage">
          {loadingFull ? (
            <div className="h5-media-viewer-loading-overlay" aria-live="polite" aria-busy="true">
              <div className="h5-media-viewer-spinner" aria-hidden />
              <p className="h5-media-viewer-loading-text">加载原图…</p>
            </div>
          ) : null}
          {loadError ? <p className="h5-media-viewer-error">原图加载失败，已显示预览图</p> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={displayUrl}
            src={displayUrl}
            alt=""
            className={`h5-media-viewer-img${loadingFull ? " is-preview" : ""}`}
            onError={() => setLoadError(true)}
          />
        </div>
        {hasNav ? (
          <div className="h5-media-viewer-counter">
            {index + 1} / {urls.length}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(viewer, document.body);
}
