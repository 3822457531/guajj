export const TG_SEARCH_API = {
  test: "/api/test/tg-search",
  prod: "/api/tg-search"
} as const;

export const TG_SEARCH_QUOTA_API = `${TG_SEARCH_API.prod}/quota`;
export const TG_SEARCH_HISTORY_API = `${TG_SEARCH_API.prod}/history`;

export type TgSearchApiScope = keyof typeof TG_SEARCH_API;

export function tgSearchCaptchaImageUrl(apiBase: string, challengeId: string) {
  return `${apiBase}/captcha/${challengeId}/image`;
}
