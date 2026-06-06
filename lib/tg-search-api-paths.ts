export const TG_SEARCH_API = {
  test: "/api/test/tg-search",
  prod: "/api/tg-search"
} as const;

export type TgSearchApiScope = keyof typeof TG_SEARCH_API;

export function tgSearchCaptchaImageUrl(apiBase: string, challengeId: string) {
  return `${apiBase}/captcha/${challengeId}/image`;
}
