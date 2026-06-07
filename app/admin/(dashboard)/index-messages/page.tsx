import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import { prisma } from "@/lib/prisma";
import {
  buildIndexMessagesListWhere,
  getIndexChannelFilterOptions,
  parseIndexChatFilter
} from "@/lib/index-message-admin";
import IndexChannelFilter from "./index-channel-filter";
import IndexMessageForm from "./index-message-form";
import IndexMessageTable from "./index-message-table";

const ALLOWED_PAGE_SIZES = [10, 50, 100] as const;

function parsePageSize(raw: string | undefined): number {
  const n = Math.floor(Number(raw));
  return ALLOWED_PAGE_SIZES.includes(n as (typeof ALLOWED_PAGE_SIZES)[number]) ? n : 10;
}

export default async function AdminIndexMessagesPage({
  searchParams
}: {
  searchParams: Promise<{
    edit?: string;
    error?: string;
    saved?: string;
    deleted?: string;
    media?: string;
    mediaFailed?: string;
    q?: string;
    chat?: string | string[];
    page?: string;
    perPage?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const selectedChatIds = parseIndexChatFilter(params.chat);
  const pageSize = parsePageSize(params.perPage);
  const rawPage = Math.max(1, Math.floor(Number(params.page) || 1));

  const listWhere = buildIndexMessagesListWhere(q, selectedChatIds);

  const [channelOptions, total] = await Promise.all([
    getIndexChannelFilterOptions(),
    prisma.tgIndexedMessage.count({ where: listWhere })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(rawPage, totalPages);

  const selectedChannelLabels = channelOptions
    .filter((c) => selectedChatIds.includes(c.chatId))
    .map((c) => c.label);

  const [rows, editing] = await Promise.all([
    prisma.tgIndexedMessage.findMany({
      where: listWhere,
      orderBy: [{ isPinned: "desc" }, { messageDate: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    params.edit
      ? prisma.tgIndexedMessage.findUnique({ where: { id: params.edit } })
      : Promise.resolve(null)
  ]);

  const clearSearchHref = (() => {
    const p = new URLSearchParams();
    if (params.edit) p.set("edit", params.edit);
    if (pageSize !== 10) p.set("perPage", String(pageSize));
    const s = p.toString();
    return s ? `${adminPath("/index-messages")}?${s}` : `${adminPath("/index-messages")}`;
  })();

  const hasFilter = Boolean(q || selectedChatIds.length);

  return (
    <>
      {params.saved ? <p className="admin-flash success">索引已保存。</p> : null}
      {params.deleted ? (
        <p className="admin-flash success">
          {Number(params.deleted) > 1 ? `已删除 ${params.deleted} 条索引。` : "索引已删除。"}
          {params.media ? ` 同步清理媒体文件 ${params.media} 个` : null}
          {params.mediaFailed && Number(params.mediaFailed) > 0 ? (
            <span style={{ color: "#b45309" }}>（{params.mediaFailed} 个媒体文件删除失败，请至存储管理检查）</span>
          ) : null}
          。
        </p>
      ) : null}
      {params.error === "empty" ? <p className="admin-flash" style={{ color: "#b45309" }}>请先勾选要删除的条目。</p> : null}

      <div className="two-col">
        <IndexMessageForm item={editing} hasError={params.error === "missing"} />
        <section className="admin-panel">
          <div className="admin-list-toolbar admin-list-toolbar-stack">
            <form method="get" action={adminPath("/index-messages")} className="admin-index-filter-form">
              {params.edit ? <input type="hidden" name="edit" value={params.edit} /> : null}
              {pageSize !== 10 ? <input type="hidden" name="perPage" value={String(pageSize)} /> : null}
              <IndexChannelFilter channels={channelOptions} selectedChatIds={selectedChatIds} />
              <div className="admin-index-filter-row">
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="搜索标题、摘要、来源…"
                  autoComplete="off"
                />
                <button type="submit" className="btn-admin-ghost">
                  查询
                </button>
                {hasFilter ? (
                  <AdminLink className="btn-admin-ghost" href={clearSearchHref} style={{ textDecoration: "none", display: "inline-flex" }}>
                    清除筛选
                  </AdminLink>
                ) : null}
              </div>
            </form>
          </div>
          {hasFilter ? (
            <p className="admin-list-meta">
              {selectedChannelLabels.length > 0 ? (
                <>频道：{selectedChannelLabels.join("、")} · </>
              ) : null}
              {q ? <>关键词「{q}」 · </> : null}
              本页 {rows.length} 条 · 共 {total} 条匹配
            </p>
          ) : null}
          <IndexMessageTable
            rows={rows}
            listQuery={q}
            selectedChatIds={selectedChatIds}
            pagination={{ total, page, pageSize, totalPages, editId: params.edit }}
          />
        </section>
      </div>
    </>
  );
}
