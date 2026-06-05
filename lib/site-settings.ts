import { prisma } from "@/lib/prisma";

const SITE_SETTINGS_ID = "main";

/** 保证存在一行站点配置（首次访问时创建） */
export async function getSiteSettings() {
  return prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    create: { id: SITE_SETTINGS_ID, allowAnonymousComments: true },
    update: {}
  });
}


export async function getAllowAnonymousComments(): Promise<boolean> {
  const row = await getSiteSettings();
  return row.allowAnonymousComments;
}
