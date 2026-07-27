"use client";

import { useState, useTransition } from "react";
import { adminQueryAgentOrderAction, reviewWithdrawalAction } from "./actions";

type OrderRow = {
  id: string;
  tradeNo: string | null;
  channelName: string;
  channelId: number;
  totalAmount: number | null;
  status: string;
  createdAt: Date | string;
  guestUser: { publicId: string; isAgent: boolean };
  package: { title: string; goodsKey: string };
};

type WithdrawRow = {
  id: string;
  amount: number;
  channel: string;
  account: string;
  accountName: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date | string;
  guestUser: { publicId: string };
};

type CommissionRow = {
  id: string;
  level: string;
  amount: number;
  orderAmount: number;
  rate: number;
  createdAt: Date | string;
  beneficiary: { publicId: string };
  fromGuest: { publicId: string };
};

function fmtTime(v: Date | string) {
  return typeof v === "string" ? new Date(v).toLocaleString("zh-CN") : v.toLocaleString("zh-CN");
}

export function AgentOrdersTable({ orders }: { orders: OrderRow[] }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <div style={{ overflowX: "auto" }}>
      {msg ? <p className="admin-flash success" style={{ margin: "0 16px 12px" }}>{msg}</p> : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>套餐</th>
            <th>渠道</th>
            <th>金额</th>
            <th>订单号</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ color: "var(--muted)" }}>
                暂无开通订单
              </td>
            </tr>
          ) : (
            orders.map((row) => (
              <tr key={row.id}>
                <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{fmtTime(row.createdAt)}</td>
                <td>
                  <code>{row.guestUser.publicId}</code>
                  {row.guestUser.isAgent ? (
                    <span style={{ marginLeft: 6, color: "#2e7d32", fontSize: 12 }}>代理</span>
                  ) : null}
                </td>
                <td>
                  {row.package.title}
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    <code>{row.package.goodsKey}</code>
                  </div>
                </td>
                <td>
                  {row.channelName} ({row.channelId})
                </td>
                <td>{row.totalAmount != null ? `¥${row.totalAmount}` : "—"}</td>
                <td style={{ fontSize: 12 }}>
                  <code>{row.tradeNo || "—"}</code>
                </td>
                <td>{row.status}</td>
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
                          const res = await adminQueryAgentOrderAction(fd);
                          setMsg(res.message || "");
                        });
                      }}
                    >
                      手动查单
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AgentWithdrawalsTable({ rows }: { rows: WithdrawRow[] }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <div style={{ overflowX: "auto" }}>
      {msg ? <p className="admin-flash success" style={{ margin: "0 16px 12px" }}>{msg}</p> : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>金额</th>
            <th>渠道/账号</th>
            <th>状态</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ color: "var(--muted)" }}>
                暂无提现单
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{fmtTime(row.createdAt)}</td>
                <td>
                  <code>{row.guestUser.publicId}</code>
                </td>
                <td style={{ fontWeight: 700 }}>¥{row.amount.toFixed(2)}</td>
                <td>
                  {row.channel === "alipay" ? "支付宝" : "微信"}
                  <div style={{ fontSize: 12 }}>
                    {row.account}
                    {row.accountName ? `（${row.accountName}）` : ""}
                  </div>
                </td>
                <td>
                  {row.status === "pending"
                    ? "待审核"
                    : row.status === "approved"
                      ? "已通过"
                      : "已拒绝"}
                </td>
                <td style={{ maxWidth: 160 }}>
                  {row.status === "pending" ? (
                    <input
                      className="form-input"
                      placeholder="备注"
                      value={notes[row.id] || ""}
                      onChange={(e) => setNotes((m) => ({ ...m, [row.id]: e.target.value }))}
                    />
                  ) : (
                    row.adminNote || "—"
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {row.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        className="btn primary"
                        style={{ marginRight: 6 }}
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", row.id);
                          fd.set("approve", "1");
                          fd.set("adminNote", notes[row.id] || "");
                          startTransition(async () => {
                            const res = await reviewWithdrawalAction(fd);
                            setMsg(res.message || "");
                          });
                        }}
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", row.id);
                          fd.set("approve", "0");
                          fd.set("adminNote", notes[row.id] || "");
                          startTransition(async () => {
                            const res = await reviewWithdrawalAction(fd);
                            setMsg(res.message || "");
                          });
                        }}
                      >
                        拒绝
                      </button>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AgentCommissionsTable({ rows }: { rows: CommissionRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>受益代理</th>
            <th>来源用户</th>
            <th>层级</th>
            <th>充值额</th>
            <th>比例</th>
            <th>佣金</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ color: "var(--muted)" }}>
                暂无佣金
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{fmtTime(row.createdAt)}</td>
                <td>
                  <code>{row.beneficiary.publicId}</code>
                </td>
                <td>
                  <code>{row.fromGuest.publicId}</code>
                </td>
                <td>{row.level === "direct" ? "直推" : "间推"}</td>
                <td>¥{row.orderAmount}</td>
                <td>{Math.round(row.rate * 10000) / 100}%</td>
                <td style={{ fontWeight: 700, color: "#2e7d32" }}>¥{row.amount.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
