import { prisma } from "@/lib/prisma";
import {
  pullTelegramUpdatesAction,
  rotateTelegramSecretAction,
  saveTelegramConfigAction,
  setTelegramWebhookAction
} from "./actions";
import TelegramImportsSection from "./telegram-imports-section";

const IMPORT_PAGE_SIZES = [10, 20, 50] as const;

function maskToken(token?: string) {
  if (!token) return "未配置";
  if (token.length <= 10) return "已配置";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export default async function TelegramPage({
  searchParams
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    webhook?: string;
    pulled?: string;
    iPage?: string;
    iSize?: string;
  }>;
}) {
  const params = await searchParams;
  const [config, categories, importTotal] = await Promise.all([
    prisma.telegramConfig.findFirst(),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.telegramImport.count()
  ]);

  const rawSize = Number(params.iSize);
  const pageSize = (IMPORT_PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : 10;
  const totalPages = Math.max(1, Math.ceil(importTotal / pageSize));
  const rawPage = Math.max(1, Math.floor(Number(params.iPage) || 1));
  const page = Math.min(rawPage, totalPages);

  const imports = await prisma.telegramImport.findMany({
    include: { post: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize
  });

  const webhookUrl = config
    ? `https://guajj.top/api/tg/webhook/${config.webhookSecret}`
    : "保存配置后生成";

  return (
    <>
      {params.saved ? <p className="admin-flash success">配置已保存。</p> : null}
      {params.webhook ? <p className="admin-flash success">Webhook 已提交给 Telegram。</p> : null}
      {params.pulled ? <p className="admin-flash success">本次拉取新增 {params.pulled} 篇内容。</p> : null}
      {params.error ? (
        <p className="admin-flash" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#b91c1c", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
          操作失败，请检查配置是否完整、机器人是否启用。
        </p>
      ) : null}

      <div className="two-col">
        <section className="form-card admin-panel" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>频道采集配置</h2>
          <form className="form-grid" action={saveTelegramConfigAction}>
            <div className="field">
              <label>Bot Token</label>
              <input name="botToken" type="password" placeholder={maskToken(config?.botToken)} />
            </div>
            <div className="field">
              <label>频道 ID 或用户名</label>
              <input name="channelId" defaultValue={config?.channelId || ""} placeholder="-1001234567890 或 @channel_name" required />
            </div>
            <div className="field">
              <label>频道备注名</label>
              <input name="channelName" defaultValue={config?.channelName || ""} placeholder="我的吃瓜频道" />
            </div>
            <div className="toolbar">
              <div className="field" style={{ flex: 1 }}>
                <label>默认分类</label>
                <select name="defaultCategoryId" defaultValue={config?.defaultCategoryId || categories[0]?.id || ""} required>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>默认状态</label>
                <select name="defaultStatus" defaultValue={config?.defaultStatus || "DRAFT"}>
                  <option value="DRAFT">采集为草稿</option>
                  <option value="PUBLISHED">直接发布</option>
                  <option value="ARCHIVED">采集为下架</option>
                </select>
              </div>
            </div>
            <label className="toolbar">
              <input name="autoPublish" type="checkbox" defaultChecked={config?.autoPublish || false} />
              自动发布到前台
            </label>
            <label className="toolbar">
              <input name="downloadMedia" type="checkbox" defaultChecked={config?.downloadMedia ?? true} />
              下载图片和视频到本地
            </label>
            <label className="toolbar">
              <input name="isEnabled" type="checkbox" defaultChecked={config?.isEnabled || false} />
              启用 TG 采集
            </label>
            <button className="btn" type="submit">保存配置</button>
          </form>
        </section>

        <section className="form-card admin-panel" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>自动化接入</h2>
          <div className="field">
            <label>Webhook 地址</label>
            <input value={webhookUrl}  />
          </div>
          <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            把机器人加入你的 Telegram 频道并设为管理员后，频道新消息会通过 webhook 进入系统。开发机本地地址需要用公网域名或内网穿透后才能给 Telegram 回调。
            转发进频道的帖子会带上「转自…」前缀，并在未开「自动发布」时仍按已审核处理为直接发布。多图相册（媒体组）会合并成一条图集，封面为首张，其余进图集网格。
            请勾选「下载图片和视频到本地」，否则前台只有占位图、无真实视频地址。默认采集为草稿时，访客无法打开 /post 详情；可在「内容管理」中改为「发布」，或使用该条目的「预览封面 / 图集 / 视频」核对媒体。
          </p>
          <form className="form-grid" action={setTelegramWebhookAction}>
            <div className="field">
              <label>公网访问地址</label>
              <input name="publicBaseUrl" placeholder="https://your-domain.com" />
            </div>
            <button className="btn secondary" type="submit">设置 Telegram Webhook</button>
          </form>
          <form action={pullTelegramUpdatesAction} style={{ marginTop: 12 }}>
            <button className="btn ghost" type="submit">手动拉取最新消息</button>
          </form>
          <form action={rotateTelegramSecretAction} style={{ marginTop: 12 }}>
            <button className="btn ghost" type="submit">重置 Webhook 密钥</button>
          </form>
        </section>
      </div>

      <TelegramImportsSection items={imports} total={importTotal} page={page} pageSize={pageSize} />
    </>
  );
}
