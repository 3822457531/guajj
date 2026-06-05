import Link from "next/link";
import type { TgIndexedMessage } from "@/lib/generated/prisma";
import { formatDuration, formatMessageDate } from "@/lib/tg-index-display";
import { resolveVipResultThumbnail, vipSourceLabel, vipTextBadgeTone } from "@/lib/vip-result-display";
import { videoSrcForListThumbnail } from "@/lib/video-tile-preview";
import { VipHighlightText } from "@/components/vip-highlight-text";

export function VipSearchResultCard({
  item,
  href,
  keyword
}: {
  item: TgIndexedMessage;
  href: string;
  keyword: string;
}) {
  const duration = formatDuration(item.durationSec);
  const thumb = resolveVipResultThumbnail(item);
  const source = vipSourceLabel(item);

  return (
    <li>
      <Link href={href} prefetch={false} className={`vip-result-item vip-result-item--${thumb.kind}`}>
        {thumb.kind === "text" ? (
          <span className={`vip-result-text-badge ${vipTextBadgeTone(item.id)}`} aria-hidden>
            文
          </span>
        ) : (
          <span className="vip-result-thumb-wrap">
            {thumb.kind === "video" ? (
              <>
                <video
                  className="vip-result-thumb-media"
                  src={thumb.url ? videoSrcForListThumbnail(thumb.url) : undefined}
                  poster={thumb.poster ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  tabIndex={-1}
                  aria-hidden
                />
                <span className="vip-result-type-badge vip-result-type-badge--video" aria-hidden>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  视频
                </span>
                <span className="vip-result-play" aria-hidden>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb.url ?? ""} alt="" className="vip-result-thumb-media" loading="lazy" />
                <span className="vip-result-type-badge vip-result-type-badge--image" aria-hidden>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" />
                  </svg>
                  图片
                </span>
              </>
            )}
          </span>
        )}

        <span className="vip-result-body">
          <span className="vip-result-title">
            {duration ? <span className="vip-result-duration">{duration}</span> : null}
            <VipHighlightText text={item.title} keyword={keyword} />
          </span>
          <span className="vip-result-snippet">
            <VipHighlightText text={item.snippet} keyword={keyword} />
          </span>
          <span className="vip-result-foot">
            <span className="vip-result-meta">
              来自：{source} · {formatMessageDate(item.messageDate)}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
