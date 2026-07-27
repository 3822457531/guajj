import { NextResponse } from "next/server";
import { reconcilePendingAgentOrders } from "@/lib/agent-pay";
import { reconcilePendingGuapiOrders } from "@/lib/guapi-pay";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function readCronKey(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("key")?.trim() || request.headers.get("x-cron-key")?.trim() || "";
}

function readPositiveInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/**
 * 宝塔「访问 URL」定时任务：自动查待支付瓜皮/代理订单并履约。
 *
 * 示例：
 *   https://你的域名/api/cron/pay-orders?key=你的密钥
 *   建议每 1～2 分钟执行一次
 */
export async function GET(request: Request) {
  const expected = process.env.PAY_ORDERS_CRON_KEY?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "cron_key_not_configured" }, { status: 503 });
  }

  const provided = readCronKey(request);
  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = readPositiveInt(searchParams.get("limit"), 40, 1, 80);
  const maxAgeHours = readPositiveInt(searchParams.get("maxAgeHours"), 48, 1, 168);
  const delayMs = readPositiveInt(searchParams.get("delayMs"), 250, 0, 2000);
  const scope = (searchParams.get("scope") || "all").trim().toLowerCase();

  try {
    const options = { limit, maxAgeHours, delayMs };
    const guapi =
      scope === "agent" ? null : await reconcilePendingGuapiOrders(options);
    const agent =
      scope === "guapi" ? null : await reconcilePendingAgentOrders(options);

    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      options: { limit, maxAgeHours, delayMs, scope: scope || "all" },
      guapi,
      agent,
      paidTotal: (guapi?.paid || 0) + (agent?.paid || 0)
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "批量查单失败";
    return NextResponse.json({ ok: false, error: "RECONCILE_FAILED", message }, { status: 500 });
  }
}
