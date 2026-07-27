"use client";

import { useState, useTransition } from "react";
import { adminQueryGuapiOrderAction } from "./actions";

type OrderRow = {
  id: string;
  tradeNo: string | null;
  channelName: string;
  channelId: number;
  guapiAmount: number;
  totalAmount: number | null;
  status: string;
  contact: string;
  paidAt: Date | string | null;
  fulfilledAt: Date | string | null;
  createdAt: Date | string;
  guestUser: { publicId: string };
  package: { title: string; goodsKey: string };
};

export function GuapiOrdersPanel({ orders }: { orders: OrderRow[] }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [msgId, setMsgId] = useState<string | null>(null);

  return (
    <div style={{ overflowX: "auto" }}>
      {msg ? (
        <p className="admin-flash success" style={{ margin: "0 16px 12px" }}>
          {msg}
        </p>
      ) : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>套餐</th>
            <th>渠道</th>
            <th>金额</th>
            <th>瓜皮</th>
            <th>订单号</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ color: "var(--muted)" }}>
                暂无订单
              </td>
            </tr>
          ) : (
            orders.map((row) => {
              const created =
                typeof row.createdAt === "string"
                  ? new Date(row.createdAt).toLocaleString("zh-CN")
                  : row.createdAt.toLocaleString("zh-CN");
              return (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{created}</td>
                  <td>
                    <code>{row.guestUser.publicId}</code>
                  </td>
                  <td>
                    {row.package.title}
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      <code>{row.package.goodsKey}</code>
                    </div>
                  </td>
                  <td>
                    {row.channelName}
                    <span style={{ color: "var(--muted)", fontSize: 12 }}> ({row.channelId})</span>
                  </td>
                  <td>{row.totalAmount != null ? `¥${row.totalAmount}` : "—"}</td>
                  <td style={{ fontWeight: 700 }}>{row.guapiAmount}</td>
                  <td style={{ fontSize: 12, wordBreak: "break-all" }}>
                    <code>{row.tradeNo || "—"}</code>
                  </td>
                  <td>
                    {row.status === "paid" ? (
                      <span style={{ color: "#2e7d32", fontWeight: 700 }}>已支付</span>
                    ) : row.status === "closed" ? (
                      <span style={{ color: "#757575" }}>已关闭</span>
                    ) : (
                      <span style={{ color: "#ef6c00", fontWeight: 700 }}>待支付</span>
                    )}
                    {row.fulfilledAt ? (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>已履约</div>
                    ) : null}
                  </td>
                  <td>
                    {row.status === "pending" && row.tradeNo ? (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("tradeNo", row.tradeNo!);
                          startTransition(async () => {
                            const res = await adminQueryGuapiOrderAction(fd);
                            setMsgId(row.id);
                            setMsg(res.message || "");
                          });
                        }}
                      >
                        {pending && msgId === row.id ? "查单中…" : "手动查单"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
