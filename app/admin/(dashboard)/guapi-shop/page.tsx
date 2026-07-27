import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { getGuapiOrdersPage, getGuapiShopSnapshot } from "./actions";
import { GuapiOrdersPanel } from "./guapi-orders-panel";
import { GuapiShopPanel } from "./guapi-shop-panel";

export default async function AdminGuapiShopPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    publicId?: string;
    tradeNo?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const status = params.status || "";
  const publicId = params.publicId || "";
  const tradeNo = params.tradeNo || "";

  const snapshot = await getGuapiShopSnapshot();
  const orders = await getGuapiOrdersPage({
    page,
    size: 20,
    status: status || undefined,
    publicId: publicId || undefined,
    tradeNo: tradeNo || undefined
  });

  const qs = (nextPage: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(nextPage));
    if (status) sp.set("status", status);
    if (publicId) sp.set("publicId", publicId);
    if (tradeNo) sp.set("tradeNo", tradeNo);
    return `${adminPath("/guapi-shop")}?${sp.toString()}`;
  };

  return (
    <>
      <p className="admin-page-note" style={{ marginTop: 0 }}>
        对接 shop.ymy9.com 易支付。前台入口：
        <Link href="/my" target="_blank" rel="noopener noreferrer">
          /my（购买瓜皮）
        </Link>
        。套餐 {snapshot.packageTotal} · 订单 {snapshot.orderTotal} · 已支付 {snapshot.paidTotal}
      </p>

      <GuapiShopPanel packages={snapshot.packages} wechatChannelId={snapshot.wechatChannelId} />

      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", marginTop: 24 }}>
        <h2 style={{ padding: "16px 20px 0", margin: 0 }}>订单列表（{orders.total}）</h2>
        <form
          method="get"
          action={adminPath("/guapi-shop")}
          className="form-grid"
          style={{ padding: "12px 20px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}
        >
          <label>
            状态
            <select name="status" className="form-input" defaultValue={status}>
              <option value="">全部</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <label>
            用户 ID
            <input name="publicId" className="form-input" placeholder="GUA-" defaultValue={publicId} />
          </label>
          <label>
            订单号
            <input name="tradeNo" className="form-input" placeholder="YMR..." defaultValue={tradeNo} />
          </label>
          <button type="submit" className="btn secondary">
            筛选
          </button>
        </form>

        <GuapiOrdersPanel orders={orders.list} />

        <div style={{ padding: 16, display: "flex", gap: 12 }}>
          {page > 1 ? (
            <Link href={qs(page - 1)} className="btn secondary">
              上一页
            </Link>
          ) : null}
          <Link href={qs(page + 1)} className="btn secondary">
            下一页
          </Link>
        </div>
      </section>
    </>
  );
}
