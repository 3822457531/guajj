"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomeListTile } from "@/lib/home-post-media";
import { videoSrcForListThumbnail } from "@/lib/video-tile-preview";

export type H5HeroSlide = {
  id: string;
  href?: string;
  title: string;
  summary: string;
  coverUrl: string;
  categoryName: string;
  tiles: HomeListTile[];
};

function collageClass(n: number): string {
  if (n <= 1) return "h5-story-collage h5-story-collage--1 h5-hero-collage";
  if (n === 2) return "h5-story-collage h5-story-collage--2 h5-hero-collage";
  if (n === 3) return "h5-story-collage h5-story-collage--3 h5-hero-collage";
  if (n === 4) return "h5-story-collage h5-story-collage--4 h5-hero-collage";
  return "h5-story-collage h5-story-collage--n h5-hero-collage";
}

function tileKey(slideId: string, index: number, tile: HomeListTile) {
  return `${slideId}-${index}-${tile.kind}-${tile.url}`;
}

function HeroSlideInner({ slide }: { slide: H5HeroSlide }) {
  const tiles = slide.tiles.length > 0 ? slide.tiles : [{ kind: "image" as const, url: slide.coverUrl }];
  const n = tiles.length;

  return (
    <div className="h5-hero-card-inner">
      <div className="h5-hero-copy">
        <span className="h5-hero-kicker">
          <span className="h5-hero-kicker-icon" aria-hidden>
            👑
          </span>
          置顶热瓜 · {slide.categoryName}
        </span>
        <h2 className="h5-hero-title">{slide.title}</h2>
        <p className="h5-hero-desc">{slide.summary}</p>
      </div>
      <div className="h5-hero-visual">
        <div className={collageClass(n)}>
          {tiles.map((tile, i) => (
            <div key={tileKey(slide.id, i, tile)} className="h5-story-tile h5-hero-tile" aria-hidden>
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
                  />
                  <span className="h5-story-tile-play" aria-hidden>
                    ▶
                  </span>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={tile.url} alt="" className="h5-story-tile-media" loading="lazy" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function H5HeroCarousel({ items }: { items: H5HeroSlide[] }) {
  const [idx, setIdx] = useState(0);
  const nSlides = items.length;

  useEffect(() => {
    if (nSlides <= 1) return;
    const t = window.setInterval(() => {
      setIdx((x) => (x + 1) % nSlides);
    }, 5500);
    return () => window.clearInterval(t);
  }, [nSlides]);

  if (nSlides === 0) return null;

  const pctPerSlide = 100 / nSlides;

  return (
    <div className="h5-hero-carousel">
      <div className="h5-hero-viewport">
        <div
          className="h5-hero-track"
          style={{
            width: `${nSlides * 100}%`,
            transform: `translate3d(-${idx * pctPerSlide}%, 0, 0)`
          }}
        >
          {items.map((slide) => (
            <Link
              key={slide.id}
              href={slide.href ?? `/post/${slide.id}`}
              prefetch={false}
              className="h5-hero-card h5-hero-slide"
              style={{ width: `${pctPerSlide}%` }}
            >
              <HeroSlideInner slide={slide} />
            </Link>
          ))}
        </div>
      </div>
      {nSlides > 1 ? (
        <div className="h5-hero-dots" role="tablist" aria-label="置顶切换">
          {items.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              className={`h5-hero-dot${i === idx ? " is-active" : ""}`}
              aria-label={`第 ${i + 1} 条`}
              aria-current={i === idx}
              onClick={(e) => {
                e.preventDefault();
                setIdx(i);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
