import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import { AdminIndexMediaPreview } from "@/components/admin-index-media-preview";
import type { TgIndexedMessage } from "@/lib/generated/prisma";
import { TgIndexContentType } from "@/lib/generated/prisma";
import { updateIndexMessageAction } from "./actions";

const contentTypeOptions: { value: TgIndexContentType; label: string }[] = [
  { value: TgIndexContentType.TEXT, label: "文本" },
  { value: TgIndexContentType.VIDEO, label: "视频" },
  { value: TgIndexContentType.PHOTO, label: "图片" },
  { value: TgIndexContentType.DOCUMENT, label: "文件" }
];

export default function IndexMessageForm({
  item,
  hasError
}: {
  item?: TgIndexedMessage | null;
  hasError: boolean;
}) {
  if (!item) {
    return (
      <div className="form-grid admin-panel" style={{ padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>编辑索引</h2>
        <p style={{ color: "var(--muted)", margin: "12px 0 0", fontSize: 14, lineHeight: 1.55 }}>
          请从右侧列表选择一条索引内容进行编辑。新条目由 Telegram 采集服务写入，不在此新建。
        </p>
      </div>
    );
  }

  const action = updateIndexMessageAction.bind(null, item.id);

  return (
    <form className="form-grid admin-panel" action={action} style={{ padding: "22px 22px 20px" }}>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>编辑索引内容</h2>
        <p style={{ margin: "10px 0 0", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "var(--muted)" }}>
            chat {item.chatId} · msg {item.messageId}
          </span>
          <AdminLink
            className="btn-admin-ghost"
            href={`${adminPath("/index-messages/preview")}/${item.id}`}
            style={{ textDecoration: "none", display: "inline-flex", fontSize: 13 }}
          >
            预览媒体 / 混排
          </AdminLink>
          <AdminLink href={`/vip/${item.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 13 }}>
            前台详情
          </AdminLink>
        </p>
      </div>
      {hasError ? (
        <p style={{ color: "#dc2626", fontWeight: 800, margin: 0 }}>请填写标题与摘要。</p>
      ) : null}

      <div className="field">
        <label htmlFor="idx-title">标题</label>
        <input id="idx-title" name="title" defaultValue={item.title} required />
      </div>
      <div className="field">
        <label htmlFor="idx-snippet">摘要</label>
        <textarea id="idx-snippet" name="snippet" defaultValue={item.snippet} required rows={3} />
      </div>
      <div className="field">
        <label htmlFor="idx-raw">正文 rawText</label>
        <textarea id="idx-raw" name="rawText" defaultValue={item.rawText} rows={6} />
      </div>

      <div className="field">
        <label htmlFor="idx-type">类型</label>
        <select id="idx-type" name="contentType" defaultValue={item.contentType}>
          {contentTypeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>媒体预览</label>
        <AdminIndexMediaPreview item={item} />
      </div>

      <div className="field">
        <label htmlFor="idx-media">主媒体 URL（mediaUrl）</label>
        <input id="idx-media" name="mediaUrl" type="text" defaultValue={item.mediaUrl ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="idx-gallery-img">额外图片 JSON 数组</label>
        <textarea id="idx-gallery-img" name="galleryImageUrls" rows={3} defaultValue={item.galleryImageUrls ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="idx-gallery-vid">额外视频 JSON 数组</label>
        <textarea id="idx-gallery-vid" name="galleryVideoUrls" rows={3} defaultValue={item.galleryVideoUrls ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="idx-blocks">混排块 contentBlocks（JSON）</label>
        <textarea id="idx-blocks" name="contentBlocks" rows={8} defaultValue={item.contentBlocks ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="idx-source-title">来源标题</label>
        <input id="idx-source-title" name="sourceTitle" defaultValue={item.sourceTitle ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="idx-source-user">来源用户名</label>
        <input id="idx-source-user" name="sourceUsername" defaultValue={item.sourceUsername ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="idx-duration">时长（秒，视频可选）</label>
        <input id="idx-duration" name="durationSec" type="number" min={0} defaultValue={item.durationSec ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="idx-views">浏览量</label>
        <input id="idx-views" name="views" type="number" min={0} step={1} defaultValue={item.views} />
        <span style={{ color: "var(--muted)", fontSize: 12, display: "block", marginTop: 4 }}>
          访客打开索引详情会自动累加，可在此手工修正。仅后台可见，前台不展示。
        </span>
      </div>
      <div className="field">
        <label htmlFor="idx-heat">排序热度 heat</label>
        <input id="idx-heat" name="heat" type="number" min={0} defaultValue={item.heat} />
        <span style={{ color: "var(--muted)", fontSize: 12, display: "block", marginTop: 4 }}>
          用于后台列表排序权重，与浏览量独立。
        </span>
      </div>

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" name="isPinned" defaultChecked={item.isPinned} style={{ width: 18, height: 18 }} />
          <span>
            <strong>首页轮播置顶</strong>（自动模式生效，最多展示 3 条）
          </span>
        </label>
      </div>

      <button type="submit" className="btn btn-admin-primary">
        保存
      </button>
    </form>
  );
}
