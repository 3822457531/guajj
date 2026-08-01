"use client";

import { readGuestIdentityBackup } from "@/lib/guest-identity-storage";
import { isShareReferrerId } from "@/lib/resource-share";

/** 读取当前登录/本地备份的 GUA ID，供分享链接写入 ref */
export function readCurrentShareReferrerId(explicit?: string | null): string | null {
  if (isShareReferrerId(explicit)) return explicit.trim();
  const backup = readGuestIdentityBackup();
  if (backup && isShareReferrerId(backup.publicId)) return backup.publicId;
  return null;
}
