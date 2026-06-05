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

export function buildReferralLink(publicId: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?ref=${encodeURIComponent(publicId)}`;
}
