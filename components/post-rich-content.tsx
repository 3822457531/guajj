"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContentBlock } from "@/lib/post-content-blocks";

function TextBlock({ text }: { text: string }) {
  const paras = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="h5-detail-prose-block">
      {paras.map((p, i) => (
        <p key={i} className="h5-detail-prose-p">
          {p.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export function PostRichContent({
  blocks,
  videoMissingHint
}: {
  blocks: ContentBlock[];
  videoMissingHint?: boolean;
}) {
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);

  const openViewer = useCallback((urls: string[], index: number) => {
    setViewer({ urls, index });
  }, []);

  const closeViewer = useCallback(() => {
    setViewer(null);
  }, []);

  const goPrev = useCallback(() => {
    setViewer((v) => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v));
  }, []);

  const goNext = useCallback(() => {
    setViewer((v) => (v && v.index < v.urls.length - 1 ? { ...v, index: v.index + 1 } : v));
  }, []);

  useEffect(() => {
    if (!viewer) return;
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
  }, [viewer, closeViewer, goPrev, goNext]);

  const viewerUrl = viewer ? viewer.urls[viewer.index] : null;

  if (blocks.length === 0 && !videoMissingHint) {
    return null;
  }

  return (
    <>
      <div className="h5-detail-rich">
        {videoMissingHint ? (
          <p className="h5-detail-quote-warn" style={{ marginBottom: 12 }}>
            类型为视频但未填写可播放地址。请在后台「视频地址」填入 MP4 / WebM / MOV 的站内路径（如 /uploads/…）。
          </p>
        ) : null}
        {blocks.map((block, index) => {
          if (block.type === "text") {
            if (!block.text.trim()) return null;
            return <TextBlock key={`t-${index}`} text={block.text} />;
          }
          if (block.type === "video") {
            return (
              <div key={`v-${index}`} className="h5-detail-video-card">
                <video
                  className="h5-detail-video"
                  src={block.src}
                  poster={block.poster || undefined}
                  controls
                  playsInline
                  preload="metadata"
                />
                <span className="h5-detail-watermark h5-detail-watermark--video" aria-hidden>
                  guajj.top
                </span>
              </div>
            );
          }
          if (block.type === "images") {
            const n = block.urls.length;
            const gridClass =
              n === 1 ? "h5-detail-img-grid h5-detail-img-grid--1" : n === 2 ? "h5-detail-img-grid h5-detail-img-grid--2" : "h5-detail-img-grid h5-detail-img-grid--3";
            return (
              <div key={`i-${index}`} className={gridClass}>
                {block.urls.map((src, j) => (
                  <button
                    key={`${src}-${j}`}
                    type="button"
                    className="h5-detail-img-cell"
                    onClick={() => openViewer(block.urls, j)}
                    aria-label="查看大图"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h5-detail-img" loading="lazy" />
                    <span className="h5-detail-watermark" aria-hidden>
                      guajj.top
                    </span>
                  </button>
                ))}
              </div>
            );
          }
          return null;
        })}
      </div>

      {viewer && viewerUrl ? (
        <div className="h5-media-viewer" role="dialog" aria-modal="true" aria-label="图片预览">
          <button type="button" className="h5-media-viewer-backdrop" onClick={closeViewer} aria-label="关闭" />
          {viewer.urls.length > 1 ? (
            <button type="button" className="h5-media-viewer-nav h5-media-viewer-prev" disabled={viewer.index <= 0} onClick={goPrev} aria-label="上一张">
              ‹
            </button>
          ) : null}
          {viewer.urls.length > 1 ? (
            <button
              type="button"
              className="h5-media-viewer-nav h5-media-viewer-next"
              disabled={viewer.index >= viewer.urls.length - 1}
              onClick={goNext}
              aria-label="下一张"
            >
              ›
            </button>
          ) : null}
          <div className="h5-media-viewer-panel">
            <button type="button" className="h5-media-viewer-close" onClick={closeViewer} aria-label="关闭">
              ✕
            </button>
            <div className="h5-media-viewer-stage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={viewerUrl} src={viewerUrl} alt="" className="h5-media-viewer-img" />
            </div>
            {viewer.urls.length > 1 ? (
              <div className="h5-media-viewer-counter">
                {viewer.index + 1} / {viewer.urls.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
