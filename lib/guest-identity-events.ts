/** 全局身份弹窗与业务页之间的同步事件 */

export const GUEST_IDENTITY_REQUIRED_EVENT = "guest-identity-required";
export const GUEST_IDENTITY_READY_EVENT = "guest-identity-ready";

/** 请求弹出注册身份弹窗（无身份时） */
export function requestGuestIdentityModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GUEST_IDENTITY_REQUIRED_EVENT));
}

/** 身份创建/恢复完成后通知业务页重试 */
export function notifyGuestIdentityReady() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GUEST_IDENTITY_READY_EVENT));
}
