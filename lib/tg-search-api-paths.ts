export const TG_SEARCH_API = {
  test: "/api/test/tg-search",
  prod: "/api/tg-search"
} as const;

export const TG_SEARCH_QUOTA_API = `${TG_SEARCH_API.prod}/quota`;
export const TG_SEARCH_HISTORY_API = `${TG_SEARCH_API.prod}/history`;
export const TG_SEARCH_VIEW_BILL_API = `${TG_SEARCH_API.prod}/view-bill`;
export const VIEW_HISTORY_API = "/api/view-history";
export const GUEST_CHECK_IN_API = "/api/guest/check-in";

/** 新资源免费预览秒数；短于此时长的视频可看完 */
export const VIEW_PREVIEW_SECONDS = 10;

export type TgSearchApiScope = keyof typeof TG_SEARCH_API;

export function tgSearchCaptchaImageUrl(apiBase: string, challengeId: string) {
  return `${apiBase}/captcha/${challengeId}/image`;
}
