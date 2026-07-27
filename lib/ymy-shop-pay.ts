import crypto from "crypto";

const DEFAULT_BASE = "https://shop.ymy9.com";
const SHOP_PATH = "/shop/KQ1DWHHG";

export type YmyCreateOrderInput = {
  goodsKey: string;
  channelId: number;
  contact: string;
  quantity?: number;
};

export type YmyCreateOrderResult = {
  ok: boolean;
  code: number;
  msg: string;
  tradeNo?: string;
  totalAmount?: number;
  payUrl?: string;
  sessionCookie?: string;
  raw: unknown;
};

export type YmyQueryOrderResult = {
  ok: boolean;
  paid: boolean;
  code: number;
  msg: string;
  raw: unknown;
};

function shopBaseUrl() {
  return (process.env.YMY_SHOP_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

function randomToken(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[crypto.randomInt(chars.length)]).join("");
}

function extractPhpSessionCookie(res: Response): string | undefined {
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];
  for (const c of cookies) {
    const match = c.match(/PHPSESSID=([^;,\s]+)/i);
    if (match) return `PHPSESSID=${match[1]}`;
  }
  // Fallback: some runtimes still expose a single Set-Cookie header
  const single = res.headers.get("set-cookie");
  if (!single) return undefined;
  const match = single.match(/PHPSESSID=([^;,\s]+)/i);
  return match ? `PHPSESSID=${match[1]}` : undefined;
}

function truncateJson(value: unknown, max = 4000): string {
  try {
    const s = JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return "";
  }
}

export async function ymyCreateOrder(input: YmyCreateOrderInput): Promise<YmyCreateOrderResult> {
  const base = shopBaseUrl();
  const juuid = randomToken(16);
  const visitorId = randomToken(9);
  const body = {
    goods_key: input.goodsKey,
    quantity: Math.max(1, input.quantity ?? 1),
    coupon_code: "",
    channel_id: input.channelId,
    contact: input.contact,
    query_password: "",
    select_cards_ids: [] as string[],
    extend: { juuid }
  };

  const res = await fetch(`${base}/shopApi/Pay/order`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: base,
      Referer: `${base}${SHOP_PATH}`,
      Visitorid: visitorId
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const sessionCookie = extractPhpSessionCookie(res);
  let json: { code?: number; msg?: string; data?: { trade_no?: string; total_amount?: number; payurl?: string } } =
    {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, code: 0, msg: "下单响应解析失败", raw: null };
  }

  const code = Number(json.code ?? 0);
  const ok = code === 1 && Boolean(json.data?.trade_no && json.data?.payurl);
  return {
    ok,
    code,
    msg: String(json.msg || (ok ? "success" : "下单失败")),
    tradeNo: json.data?.trade_no,
    totalAmount: json.data?.total_amount != null ? Number(json.data.total_amount) : undefined,
    payUrl: json.data?.payurl,
    sessionCookie,
    raw: json
  };
}

export async function ymyQueryOrder(
  tradeNo: string,
  sessionCookie?: string | null
): Promise<YmyQueryOrderResult> {
  const base = shopBaseUrl();
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Origin: base,
    Referer: `${base}${SHOP_PATH}`
  };
  if (sessionCookie) headers.Cookie = sessionCookie;

  const res = await fetch(`${base}/shopApi/Pay/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ trade_no: tradeNo }),
    cache: "no-store"
  });

  let json: { code?: number; msg?: string; data?: unknown } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, paid: false, code: 0, msg: "查单响应解析失败", raw: null };
  }

  const code = Number(json.code ?? 0);
  const msg = String(json.msg || "");
  const paid = code === 1 && /success/i.test(msg);
  return {
    ok: true,
    paid,
    code,
    msg: msg || (paid ? "success" : "not pay"),
    raw: json
  };
}

export { truncateJson };
