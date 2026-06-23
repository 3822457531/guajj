/** 平台认定的真实手机号段：13 / 15 / 18 / 19 开头，排除 16 / 17 等虚拟号段 */
const REAL_MOBILE_PREFIX_RE = /^(13|15|18|19)\d{9}$/;

export function normalizeMobileDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

/** 是否为 11 位真实手机号段（用于随机取号时的本地过滤） */
export function isRealMobileNumber(phone: string) {
  const digits = normalizeMobileDigits(phone);
  return REAL_MOBILE_PREFIX_RE.test(digits);
}

export const SMS_REAL_NUMBER_MAX_RETRIES = 20;
