"use client";

const STORAGE_KEY = "chigua:guest-identity";

export type GuestIdentityBackup = {
  publicId: string;
  secretKey: string;
};

export function readGuestIdentityBackup(): GuestIdentityBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestIdentityBackup;
    if (typeof parsed.publicId === "string" && typeof parsed.secretKey === "string") {
      return { publicId: parsed.publicId, secretKey: parsed.secretKey };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveGuestIdentityBackup(identity: GuestIdentityBackup) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

/** SSR/渲染用相对路径，避免 hydration 与 window.location 不一致 */
export function buildReferralLink(publicId: string) {
  return `/?ref=${encodeURIComponent(publicId)}`;
}

/** 复制/分享时用完整 URL（仅客户端调用） */
export function buildAbsoluteReferralLink(publicId: string) {
  const path = buildReferralLink(publicId);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
