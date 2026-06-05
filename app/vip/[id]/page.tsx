import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostRichContent } from "@/components/post-rich-content";
import { VipBottomNav } from "@/components/vip-bottom-nav";
import { VipHighlightText } from "@/components/vip-highlight-text";
import {
  buildRenderableBlocksForIndex,
  dropLeadingTextBlockIfEqualsBody
} from "@/lib/tg-index-content-blocks";
import {
  buildVipListHref,
  contentTypeIcon,
  contentTypeLabel,
  formatDuration,
  formatMessageDate
} from "@/lib/tg-index-display";
import { prisma } from "@/lib/prisma";
import { getPublicIndexedMessage } from "@/lib/tg-index-search";
import { stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";

export const dynamic = "force-dynamic";

function parsePage(raw: string | undefined) {
  const n = Math.floor(Number(raw) || 1);
  return n > 0 ? n : 1;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getPublicIndexedMessage(id);
  if (!item) return { title: "未找到 · VIP搜索" };
  return { title: `${item.title} · VIP搜索`, description: item.snippet };
}

export default async function VipDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const qRaw = typeof query.q === "string" ? query.q : "";
  const q = qRaw.trim();
  const page = parsePage(query.page);
  const backHref = q ? buildVipListHref(q, page) : "/vip";

  const item = await getPublicIndexedMessage(id);
  if (!item) notFound();

  await prisma.tgIndexedMessage.update({ where: { id: item.id }, data: { views: { increment: 1 } } });

  const duration = formatDuration(item.durationSec);
  const sourceLabel =
    item.sourceTitle || (item.sourceUsername ? `@${item.sourceUsername.replace(/^@/, "")}` : null);

  const bodyDisplay = stripRepostAttributionFromText(item.rawText || "");
  const showQuote =
    bodyDisplay.trim() &&
    bodyDisplay !== "(无文字)" &&
    bodyDisplay !== "无标题" &&
    bodyDisplay.trim() !== item.title.trim();

  const richBlocks = dropLeadingTextBlockIfEqualsBody(
    buildRenderableBlocksForIndex(item),
    item.rawText || ""
  );

  return (
    <main className="site-shell h5-home vip-page vip-detail-page h5-detail-page">
      <header className="h5-top vip-top">
        <div className="vip-detail-head">
          <Link href={backHref} prefetch={false} className="vip-back-link">
            ← 返回结果
          </Link>
        </div>
      </header>

      <article className="h5-container vip-detail h5-detail-card">
        <div className="h5-detail-card-inner">
          <div className="vip-detail-type">
            <span aria-hidden>{contentTypeIcon(item.contentType)}</span>
            {contentTypeLabel(item.contentType)}
            {duration ? <span className="vip-result-duration">{duration}</span> : null}
          </div>

          <h1 className="vip-detail-title h5-detail-title">
            {q ? <VipHighlightText text={item.title} keyword={q} /> : item.title}
          </h1>

          <p className="vip-detail-meta h5-detail-meta">
            {sourceLabel ? <span>类型：{sourceLabel}</span> : null}
            <span>发布时间：{formatMessageDate(item.messageDate)}</span>
          </p>

          {showQuote ? (
            <div className="h5-detail-quote" lang="zh-Hans">
              <span className="h5-detail-quote-mark" aria-hidden>
                "
              </span>
              <p className="h5-detail-quote-body">
                {q ? <VipHighlightText text={bodyDisplay} keyword={q} /> : bodyDisplay}
              </p>
            </div>
          ) : null}

          <PostRichContent blocks={richBlocks} />

          <p className="vip-detail-foot">
            索引 ID {item.chatId}:{item.messageId}
          </p>
        </div>
      </article>

      <VipBottomNav active="vip" />
    </main>
  );
}
