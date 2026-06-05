const API_BASE = "https://u.suyanw.cn/connect.php";

export const SUYANW_LOGIN_TYPES = [
  "qq",
  "wx",
  "alipay",
  "sina",
  "baidu",
  "douyin",
  "huawei",
  // "google",
  // "microsoft",
  // "twitter",
  // "dingtalk",
  // "gitee",
  // "github"
] as const;

export type SuyanwLoginType = (typeof SUYANW_LOGIN_TYPES)[number];

export function isSuyanwLoginType(t: string): t is SuyanwLoginType {
  return (SUYANW_LOGIN_TYPES as readonly string[]).includes(t);
}

type LoginUrlResponse = { code: number; msg?: string; type?: string; url?: string; qrcode?: string };

type CallbackUserResponse = {
  code: number;
  msg?: string;
  type?: string;
  access_token?: string;
  social_uid?: string;
  faceimg?: string;
  nickname?: string;
  location?: string;
  gender?: string;
  ip?: string;
};

function requireKeys() {
  const appid = process.env.SUYANW_APPID;
  const appkey = process.env.SUYANW_APPKEY;
  if (!appid || !appkey) {
    throw new Error("请在环境变量中配置 SUYANW_APPID 与 SUYANW_APPKEY");
  }
  return { appid, appkey };
}

export async function fetchSuyanwLoginUrl(type: SuyanwLoginType, redirectUri: string) {
  const { appid, appkey } = requireKeys();
  const url = `${API_BASE}?act=login&appid=${encodeURIComponent(appid)}&appkey=${encodeURIComponent(appkey)}&type=${encodeURIComponent(type)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as LoginUrlResponse;
  if (json.code !== 0 || !json.url) {
    throw new Error(json.msg || "获取登录地址失败");
  }
  return json.url;
}

export async function fetchSuyanwUserByCode(type: SuyanwLoginType, code: string) {
  const { appid, appkey } = requireKeys();
  const url = `${API_BASE}?act=callback&appid=${encodeURIComponent(appid)}&appkey=${encodeURIComponent(appkey)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as CallbackUserResponse;
  if (json.code !== 0 || !json.social_uid || !json.nickname) {
    throw new Error(json.msg || "换取用户信息失败");
  }
  return {
    type,
    socialUid: json.social_uid,
    nickname: json.nickname,
    faceimg: json.faceimg || "",
    gender: json.gender || null,
    location: json.location || null,
    accessToken: json.access_token || null
  };
}
