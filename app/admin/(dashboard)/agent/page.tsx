import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import {
  getAgentAdminSnapshot,
  getAgentCommissionsPage,
  getAgentOrdersPage,
  getAgentWithdrawalsPage
} from "./actions";
import { AgentAdminPanel } from "./agent-admin-panel";
import { AgentCommissionsTable, AgentOrdersTable, AgentWithdrawalsTable } from "./agent-tables";

export default async function AdminAgentPage({
  searchParams
}: {
  searchParams: Promise<{
    orderPage?: string;
    withdrawPage?: string;
    commissionPage?: string;
    orderStatus?: string;
    withdrawStatus?: string;
    publicId?: string;
    tradeNo?: string;
  }>;
}) {
  const params = await searchParams;
  const orderPage = Math.max(1, parseInt(params.orderPage || "1", 10));
  const withdrawPage = Math.max(1, parseInt(params.withdrawPage || "1", 10));
  const commissionPage = Math.max(1, parseInt(params.commissionPage || "1", 10));
  const orderStatus = params.orderStatus || "";
  const withdrawStatus = params.withdrawStatus || "pending";
  const publicId = params.publicId || "";
  const tradeNo = params.tradeNo || "";

  const snapshot = await getAgentAdminSnapshot();
  const [orders, withdrawals, commissions] = await Promise.all([
    getAgentOrdersPage({
      page: orderPage,
      size: 20,
      status: orderStatus || undefined,
      publicId: publicId || undefined,
      tradeNo: tradeNo || undefined
    }),
    getAgentWithdrawalsPage({
      page: withdrawPage,
      size: 20,
      status: withdrawStatus || undefined,
      publicId: publicId || undefined
    }),
    getAgentCommissionsPage(commissionPage, 20)
  ]);

  const base = adminPath("/agent");

  return (
    <>
      <p className="admin-page-note" style={{ marginTop: 0 }}>
        前台入口：
        <Link href="/agent" target="_blank" rel="noopener noreferrer">
          /agent
        </Link>
        。开通订单 {snapshot.orderTotal}（已付 {snapshot.paidOrderTotal}）· 待审提现{" "}
        {snapshot.pendingWithdraw} · 佣金流水 {snapshot.commissionTotal}
      </p>

      <AgentAdminPanel packages={snapshot.packages} rates={snapshot.rates} />

      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginTop: 24 }}>
        <h2 style={{ padding: "16px 20px 0", margin: 0 }}>提现管理（{withdrawals.total}）</h2>
        <form
          method="get"
          action={base}
          className="form-grid"
          style={{ padding: "12px 20px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}
        >
          <input type="hidden" name="orderPage" value={String(orderPage)} />
          <input type="hidden" name="commissionPage" value={String(commissionPage)} />
          <label>
            提现状态
            <select name="withdrawStatus" className="form-input" defaultValue={withdrawStatus}>
              <option value="">全部</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
          </label>
          <label>
            用户 ID
            <input name="publicId" className="form-input" defaultValue={publicId} placeholder="GUA-" />
          </label>
          <button type="submit" className="btn secondary">
            筛选
          </button>
        </form>
        <AgentWithdrawalsTable rows={withdrawals.list} />
        <div style={{ padding: 16, display: "flex", gap: 12 }}>
          {withdrawPage > 1 ? (
            <Link
              href={`${base}?withdrawPage=${withdrawPage - 1}&withdrawStatus=${withdrawStatus}&publicId=${encodeURIComponent(publicId)}`}
              className="btn secondary"
            >
              上一页
            </Link>
          ) : null}
          <Link
            href={`${base}?withdrawPage=${withdrawPage + 1}&withdrawStatus=${withdrawStatus}&publicId=${encodeURIComponent(publicId)}`}
            className="btn secondary"
          >
            下一页
          </Link>
        </div>
      </section>

      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginTop: 24 }}>
        <h2 style={{ padding: "16px 20px 0", margin: 0 }}>开通订单（{orders.total}）</h2>
        <form
          method="get"
          action={base}
          className="form-grid"
          style={{ padding: "12px 20px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}
        >
          <input type="hidden" name="withdrawPage" value={String(withdrawPage)} />
          <input type="hidden" name="withdrawStatus" value={withdrawStatus} />
          <input type="hidden" name="commissionPage" value={String(commissionPage)} />
          <label>
            订单状态
            <select name="orderStatus" className="form-input" defaultValue={orderStatus}>
              <option value="">全部</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <label>
            用户 ID
            <input name="publicId" className="form-input" defaultValue={publicId} />
          </label>
          <label>
            订单号
            <input name="tradeNo" className="form-input" defaultValue={tradeNo} />
          </label>
          <button type="submit" className="btn secondary">
            筛选
          </button>
        </form>
        <AgentOrdersTable orders={orders.list} />
        <div style={{ padding: 16, display: "flex", gap: 12 }}>
          {orderPage > 1 ? (
            <Link href={`${base}?orderPage=${orderPage - 1}`} className="btn secondary">
              上一页
            </Link>
          ) : null}
          <Link href={`${base}?orderPage=${orderPage + 1}`} className="btn secondary">
            下一页
          </Link>
        </div>
      </section>

      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginTop: 24 }}>
        <h2 style={{ padding: "16px 20px 0", margin: 0 }}>佣金流水（{commissions.total}）</h2>
        <AgentCommissionsTable rows={commissions.list} />
        <div style={{ padding: 16, display: "flex", gap: 12 }}>
          {commissionPage > 1 ? (
            <Link href={`${base}?commissionPage=${commissionPage - 1}`} className="btn secondary">
              上一页
            </Link>
          ) : null}
          <Link href={`${base}?commissionPage=${commissionPage + 1}`} className="btn secondary">
            下一页
          </Link>
        </div>
      </section>
    </>
  );
}
