const BASE = "https://lubansms.com/v2/api";

async function lubanGet(path: string, params: Record<string, string>, timeoutMs: number) {
  const qs = new URLSearchParams(params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}?${qs}`, { signal: controller.signal, cache: "no-store" });
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

export async function getKeywordNumber(apikey: string, phone = "", cardType = "") {
  return lubanGet("/getKeywordNumber", { apikey, phone, cardType }, 15000);
}

export async function getKeywordSms(apikey: string, phone: string, keyword: string) {
  return lubanGet("/getKeywordSms", { apikey, phone, keyword }, 60000);
}

export async function delKeywordNumber(apikey: string, phone: string) {
  return lubanGet("/delKeywordNumber", { apikey, phone }, 15000);
}

export async function bulksms(
  apikey: string,
  telList: string[],
  type: 0 | 1,
  text: string,
  from: string
) {
  return lubanGet(
    "/bulksms",
    {
      apikey,
      tel_list: telList.join(","),
      type: String(type),
      text,
      from
    },
    15000
  );
}

export async function getLubanBalance(apikey: string) {
  try {
    return lubanGet("/getBalance", { apikey }, 10000);
  } catch {
    return { code: -1, msg: "余额接口未配置或请求失败", balance: null };
  }
}

export type LubanResponse = {
  code?: number;
  msg?: string;
  phone?: string;
  [key: string]: unknown;
};
