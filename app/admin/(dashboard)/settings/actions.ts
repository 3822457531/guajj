"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SITE_SETTINGS_ID = "main";

export async function updateSiteSettingsAction(formData: FormData) {
  await requireAdmin();
  const allow = formData.get("allowAnonymousComments") === "on";
  const homeFeedMode = String(formData.get("homeFeedMode") || "manual").trim() === "auto" ? "auto" : "manual";
  const mediaStorage = String(formData.get("mediaStorage") || "local").trim() === "r2" ? "r2" : "local";
  const r2AccountId = String(formData.get("r2AccountId") || "").trim() || null;
  const r2BucketName = String(formData.get("r2BucketName") || "").trim() || null;
  const r2PublicBaseUrl = String(formData.get("r2PublicBaseUrl") || "").trim().replace(/\/+$/, "") || null;
  const newAccessKey = String(formData.get("r2AccessKeyId") || "").trim();
  const newSecretKey = String(formData.get("r2SecretAccessKey") || "").trim();
  const blockedKeywordsRaw = String(formData.get("blockedKeywords") || "");
  const dailySearchLimit = Math.max(0, Math.floor(Number(formData.get("dailySearchLimit")) || 3));
  const referralSearchBonus = Math.max(0, Math.floor(Number(formData.get("referralSearchBonus")) || 1));

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    create: {
      id: SITE_SETTINGS_ID,
      allowAnonymousComments: allow,
      homeFeedMode,
      mediaStorage,
      r2AccountId,
      r2BucketName,
      r2PublicBaseUrl,
      r2AccessKeyId: newAccessKey || null,
      r2SecretAccessKey: newSecretKey || null,
      blockedKeywords: blockedKeywordsRaw.trim() || null,
      dailySearchLimit,
      referralSearchBonus
    },
    update: {
      allowAnonymousComments: allow,
      homeFeedMode,
      mediaStorage,
      r2AccountId,
      r2BucketName,
      r2PublicBaseUrl,
      blockedKeywords: blockedKeywordsRaw.trim() || null,
      dailySearchLimit,
      referralSearchBonus,
      ...(newAccessKey ? { r2AccessKeyId: newAccessKey } : {}),
      ...(newSecretKey ? { r2SecretAccessKey: newSecretKey } : {})
    }
  });

  revalidatePath("/");
  revalidatePath("/vip");
  revalidatePath("/my");
  revalidatePath("/admin/settings");
  redirect(`${adminPath("/settings")}?saved=1`);
}
