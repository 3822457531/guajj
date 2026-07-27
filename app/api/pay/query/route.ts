import { getGuestSessionPayload } from "@/lib/guest-auth";
import { queryAndFulfillGuapiOrder } from "@/lib/guapi-pay";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getGuestSessionPayload();
  if (!session) {
    return Response.json({ ok: false, message: "请先获取匿名身份" }, { status: 401 });
  }

  let body: { tradeNo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const tradeNo = String(body.tradeNo || "").trim();
  if (!tradeNo) {
    return Response.json({ ok: false, message: "缺少订单号" }, { status: 400 });
  }

  const result = await queryAndFulfillGuapiOrder({
    tradeNo,
    guestUserId: session.guestUserId
  });

  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 400 });
  }

  return Response.json({
    ok: true,
    status: result.status,
    paid: result.paid,
    guapiAmount: result.guapiAmount,
    message: result.message,
    quota: result.quota
      ? {
          remaining: result.quota.remaining,
          limit: result.quota.limit,
          used: result.quota.used,
          searchBonus: result.quota.searchBonus
        }
      : undefined
  });
}
