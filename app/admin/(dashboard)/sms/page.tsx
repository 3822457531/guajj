import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { getSmsAdminSnapshot, getSmsGuapiLogsPage, getSmsLogsPage } from "./actions";
import { SmsAdminPanel } from "./sms-admin-panel";

export default async function AdminSmsPage({
  searchParams
}: {
  searchParams: Promise<{ logPage?: string; guapiPage?: string }>;
}) {
  const params = await searchParams;
  const logPage = Math.max(1, parseInt(params.logPage || "1", 10));
  const guapiPage = Math.max(1, parseInt(params.guapiPage || "1", 10));

  const snapshot = await getSmsAdminSnapshot();
  const [logs, guapiLogs] = await Promise.all([
    getSmsLogsPage(logPage, 20),
    getSmsGuapiLogsPage(guapiPage, 20)
  ]);

  return (
    <>
      <p className="admin-page-note" style={{ marginTop: 0 }}>
        暗网手机号对接 LubanSMS，前台用户使用<strong>瓜皮</strong>计费。前台入口：
        <Link href="/sms" target="_blank" rel="noopener noreferrer">
          /sms（暗网手机号）
        </Link>
      </p>

      <SmsAdminPanel
        pricing={snapshot.pricing}
        apikeyConfigured={snapshot.apikeyConfigured}
        apikeyMask={snapshot.apikeyMask}
        guests={snapshot.guests}
      />

      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginTop: 24 }}>
        <h2 style={{ padding: "16px 20px 0", margin: 0 }}>API 操作日志（{snapshot.logTotal}）</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>用户</th>
                <th>动作</th>
                <th>号码</th>
                <th>关键词</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {logs.list.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{row.createdAt.toLocaleString("zh-CN")}</td>
                  <td>
                    <code>{row.guestUser?.publicId ?? "—"}</code>
                  </td>
                  <td>{row.action}</td>
                  <td>{row.phone ?? "—"}</td>
                  <td>{row.keyword ?? "—"}</td>
                  <td style={{ maxWidth: 240, wordBreak: "break-all", fontSize: 12 }}>{row.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 16, display: "flex", gap: 12 }}>
          {logPage > 1 ? (
            <Link href={`${adminPath("/sms")}?logPage=${logPage - 1}&guapiPage=${guapiPage}`} className="btn secondary">
              上一页
            </Link>
          ) : null}
          <Link href={`${adminPath("/sms")}?logPage=${logPage + 1}&guapiPage=${guapiPage}`} className="btn secondary">
            下一页
          </Link>
        </div>
      </section>

      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginTop: 24 }}>
        <h2 style={{ padding: "16px 20px 0", margin: 0 }}>瓜皮流水（{snapshot.guapiLogTotal}）</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>用户</th>
                <th>变动</th>
                <th>类型</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {guapiLogs.list.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{row.createdAt.toLocaleString("zh-CN")}</td>
                  <td>
                    <code>{row.guestUser.publicId}</code>
                  </td>
                  <td style={{ fontWeight: 700, color: row.amount > 0 ? "#2e7d32" : "#c62828" }}>
                    {row.amount > 0 ? "+" : ""}
                    {row.amount}
                  </td>
                  <td>{row.type}</td>
                  <td>{row.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 16, display: "flex", gap: 12 }}>
          {guapiPage > 1 ? (
            <Link href={`${adminPath("/sms")}?logPage=${logPage}&guapiPage=${guapiPage - 1}`} className="btn secondary">
              上一页
            </Link>
          ) : null}
          <Link href={`${adminPath("/sms")}?logPage=${logPage}&guapiPage=${guapiPage + 1}`} className="btn secondary">
            下一页
          </Link>
        </div>
      </section>
    </>
  );
}
