"use server";

import { adminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/auth";
import { queryAndFulfillGuapiOrder } from "@/lib/guapi-pay";
import { getWechatChannelId, setWechatChannelId, PAY_CHANNEL_WECHAT, PAY_CHANNEL_WECHAT_RECOMMENDED } from "@/lib/pay-config";
import { prisma } from "@/lib/prisma";
import { GuapiOrderStatus, Prisma } from "@/lib/generated/prisma";
import { revalidatePath } from "next/cache";

function revalidateShop() {
  revalidatePath(`${adminPath("/guapi-shop")}`);
}

export async function getGuapiShopSnapshot() {
  await requireAdmin();
  const [packageTotal, orderTotal, paidTotal, wechatChannelId] = await Promise.all([
    prisma.guapiPackage.count(),
    prisma.guapiOrder.count(),
    prisma.guapiOrder.count({ where: { status: GuapiOrderStatus.paid } }),
    getWechatChannelId()
  ]);
  const packages = await prisma.guapiPackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });
  return {
    packageTotal,
    orderTotal,
    paidTotal,
    wechatChannelId,
    packages: packages.map((p) => ({
      ...p,
      priceYuan: Number(p.priceYuan)
    }))
  };
}

export async function getGuapiOrdersPage(input: {
  page: number;
  size: number;
  status?: string;
  publicId?: string;
  tradeNo?: string;
}) {
  await requireAdmin();
  const page = Math.max(1, input.page);
  const size = Math.min(50, Math.max(1, input.size));
  const skip = (page - 1) * size;

  const where: Prisma.GuapiOrderWhereInput = {};
  if (input.status === "pending" || input.status === "paid" || input.status === "closed") {
    where.status = input.status;
  }
  if (input.tradeNo?.trim()) {
    where.tradeNo = { contains: input.tradeNo.trim() };
  }
  if (input.publicId?.trim()) {
    where.guestUser = { publicId: { contains: input.publicId.trim() } };
  }

  const [list, total] = await Promise.all([
    prisma.guapiOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: {
        guestUser: { select: { publicId: true } },
        package: { select: { title: true, goodsKey: true } }
      }
    }),
    prisma.guapiOrder.count({ where })
  ]);

  return {
    list: list.map((row) => ({
      ...row,
      totalAmount: row.totalAmount != null ? Number(row.totalAmount) : null
    })),
    total,
    page,
    size
  };
}

export async function saveWechatChannelAction(formData: FormData) {
  await requireAdmin();
  const channelId = Number(formData.get("wechatChannelId"));
  if (channelId !== PAY_CHANNEL_WECHAT && channelId !== PAY_CHANNEL_WECHAT_RECOMMENDED) {
    return { ok: false, message: "请选择有效的微信渠道" };
  }
  await setWechatChannelId(channelId);
  revalidateShop();
  return { ok: true, message: "微信渠道已保存" };
}

export async function upsertGuapiPackageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const goodsKey = String(formData.get("goodsKey") || "").trim();
  const guapiAmount = Math.round(Number(formData.get("guapiAmount")));
  const priceYuan = Number(formData.get("priceYuan"));
  const sortOrder = Math.round(Number(formData.get("sortOrder") || 0));
  const enabled = String(formData.get("enabled") || "") === "1" || String(formData.get("enabled")) === "on";

  if (!title || !goodsKey) return { ok: false, message: "请填写标题与 goods_key" };
  if (!Number.isFinite(guapiAmount) || guapiAmount <= 0) {
    return { ok: false, message: "瓜皮数量须为正整数" };
  }
  if (!Number.isFinite(priceYuan) || priceYuan < 0) {
    return { ok: false, message: "请填写有效标价" };
  }

  const data = {
    title,
    goodsKey,
    guapiAmount,
    priceYuan: new Prisma.Decimal(priceYuan),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    enabled
  };

  if (id) {
    const exists = await prisma.guapiPackage.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return { ok: false, message: "套餐不存在" };
    await prisma.guapiPackage.update({ where: { id }, data });
  } else {
    await prisma.guapiPackage.create({ data });
  }

  revalidateShop();
  return { ok: true, message: id ? "套餐已更新" : "套餐已创建" };
}

export async function deleteGuapiPackageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, message: "缺少套餐 ID" };
  const orderCount = await prisma.guapiOrder.count({ where: { packageId: id } });
  if (orderCount > 0) {
    await prisma.guapiPackage.update({ where: { id }, data: { enabled: false } });
    revalidateShop();
    return { ok: true, message: "套餐已有订单，已改为下架（未删除）" };
  }
  await prisma.guapiPackage.delete({ where: { id } });
  revalidateShop();
  return { ok: true, message: "套餐已删除" };
}

export async function toggleGuapiPackageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const enabled = String(formData.get("enabled") || "") === "1";
  if (!id) return { ok: false, message: "缺少套餐 ID" };
  await prisma.guapiPackage.update({ where: { id }, data: { enabled } });
  revalidateShop();
  return { ok: true, message: enabled ? "已上架" : "已下架" };
}

export async function adminQueryGuapiOrderAction(formData: FormData) {
  await requireAdmin();
  const tradeNo = String(formData.get("tradeNo") || "").trim();
  if (!tradeNo) return { ok: false, message: "缺少订单号" };
  const result = await queryAndFulfillGuapiOrder({ tradeNo, asAdmin: true });
  revalidateShop();
  if (!result.ok) return { ok: false, message: result.message };
  return {
    ok: true,
    message: result.paid ? `已到账：+${result.guapiAmount} 瓜皮` : result.message
  };
}
