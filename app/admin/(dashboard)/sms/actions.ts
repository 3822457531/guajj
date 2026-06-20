"use server";

import { adminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/auth";
import { getLubanBalance } from "@/lib/luban-sms";
import { prisma } from "@/lib/prisma";
import { addGuestGuapi } from "@/lib/sms-guapi";
import { getLubanApikey, getSmsPricing, setLubanApikey, setSmsPricing } from "@/lib/sms-config";
import { revalidatePath } from "next/cache";

export async function saveSmsApikeyAction(formData: FormData) {
  await requireAdmin();
  const apikey = String(formData.get("apikey") || "").trim();
  if (!apikey) return { ok: false, message: "请输入 API Key" };
  await setLubanApikey(apikey);
  revalidatePath(`${adminPath("/sms")}`);
  return { ok: true, message: "保存成功" };
}

export async function saveSmsPricingAction(formData: FormData) {
  await requireAdmin();
  await setSmsPricing({
    get_number: Number(formData.get("get_number")),
    get_sms: Number(formData.get("get_sms")),
    send_sms: Number(formData.get("send_sms"))
  });
  revalidatePath(`${adminPath("/sms")}`);
  return { ok: true, message: "定价已保存" };
}

export async function rechargeGuestGuapiAction(formData: FormData) {
  await requireAdmin();
  const guestUserId = String(formData.get("guestUserId") || "").trim();
  const amount = Math.round(Number(formData.get("amount")));
  const remark = String(formData.get("remark") || "").trim();
  if (!guestUserId || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "请输入有效用户与瓜皮数量" };
  }
  const user = await prisma.guestUser.findUnique({ where: { id: guestUserId }, select: { id: true } });
  if (!user) return { ok: false, message: "用户不存在" };
  await addGuestGuapi(guestUserId, amount, "recharge", remark || "管理员充值");
  revalidatePath(`${adminPath("/sms")}`);
  revalidatePath(`${adminPath("/users")}`);
  return { ok: true, message: "充值成功" };
}

export async function loadLubanBalanceAction() {
  await requireAdmin();
  const apikey = await getLubanApikey();
  if (!apikey) return { ok: true, balance: null, message: "未配置 API Key" };
  const data = await getLubanBalance(apikey);
  return {
    ok: true,
    balance: data.balance ?? null,
    message: String(data.msg || "")
  };
}

export async function getSmsAdminSnapshot() {
  await requireAdmin();
  const [pricing, apikey, logTotal, guapiLogTotal, guests] = await Promise.all([
    getSmsPricing(),
    getLubanApikey(),
    prisma.smsLog.count(),
    prisma.smsGuapiLog.count(),
    prisma.guestUser.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, publicId: true, searchBonus: true, createdAt: true }
    })
  ]);
  return {
    pricing,
    apikeyConfigured: Boolean(apikey),
    apikeyMask: apikey ? `${apikey.slice(0, 4)}****${apikey.slice(-4)}` : "",
    logTotal,
    guapiLogTotal,
    guests
  };
}

export async function getSmsLogsPage(page: number, size: number) {
  await requireAdmin();
  const skip = (page - 1) * size;
  const [list, total] = await Promise.all([
    prisma.smsLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: { guestUser: { select: { publicId: true } } }
    }),
    prisma.smsLog.count()
  ]);
  return { list, total, page, size };
}

export async function getSmsGuapiLogsPage(page: number, size: number, guestUserId?: string) {
  await requireAdmin();
  const skip = (page - 1) * size;
  const where = guestUserId ? { guestUserId } : {};
  const [list, total] = await Promise.all([
    prisma.smsGuapiLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: { guestUser: { select: { publicId: true } } }
    }),
    prisma.smsGuapiLog.count({ where })
  ]);
  return { list, total, page, size };
}
