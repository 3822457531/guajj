import { prisma } from "@/lib/prisma";
import { GuapiOrderStatus, Prisma } from "@/lib/generated/prisma";
import { getGuestGlobalSearchQuota } from "@/lib/search-quota";
import {
  channelNameOf,
  getWechatChannelId,
  isAllowedPayChannel,
  PAY_CHANNEL_ALIPAY
} from "@/lib/pay-config";
import { truncateJson, ymyCreateOrder, ymyQueryOrder } from "@/lib/ymy-shop-pay";
import { grantCommissionsForGuapiOrder } from "@/lib/agent-commission";

export type CreateGuapiOrderResult =
  | {
      ok: true;
      orderId: string;
      tradeNo: string;
      payUrl: string;
      totalAmount: number | null;
      channelId: number;
      channelName: string;
      guapiAmount: number;
    }
  | { ok: false; message: string };

export type QueryGuapiOrderResult =
  | {
      ok: true;
      status: GuapiOrderStatus;
      paid: boolean;
      guapiAmount: number;
      quota?: Awaited<ReturnType<typeof getGuestGlobalSearchQuota>>;
      message: string;
    }
  | { ok: false; message: string };

export async function listEnabledGuapiPackages() {
  const wechatChannelId = await getWechatChannelId();
  const packages = await prisma.guapiPackage.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      guapiAmount: true,
      priceYuan: true,
      sortOrder: true
    }
  });
  return {
    packages: packages.map((p) => ({
      id: p.id,
      title: p.title,
      guapiAmount: p.guapiAmount,
      priceYuan: Number(p.priceYuan),
      sortOrder: p.sortOrder
    })),
    channels: [
      { id: PAY_CHANNEL_ALIPAY, name: "支付宝", kind: "alipay" as const },
      { id: wechatChannelId, name: "微信", kind: "wechat" as const }
    ]
  };
}

export async function createGuapiOrderForGuest(input: {
  guestUserId: string;
  publicId: string;
  packageId: string;
  channelId: number;
}): Promise<CreateGuapiOrderResult> {
  const wechatDefault = await getWechatChannelId();
  if (!isAllowedPayChannel(input.channelId, wechatDefault)) {
    return { ok: false, message: "不支持的支付渠道" };
  }

  const pkg = await prisma.guapiPackage.findFirst({
    where: { id: input.packageId, enabled: true }
  });
  if (!pkg) return { ok: false, message: "套餐不存在或已下架" };

  const channelName = channelNameOf(input.channelId);
  const contact = input.publicId;

  const order = await prisma.guapiOrder.create({
    data: {
      guestUserId: input.guestUserId,
      packageId: pkg.id,
      channelId: input.channelId,
      channelName,
      quantity: 1,
      guapiAmount: pkg.guapiAmount,
      contact,
      status: GuapiOrderStatus.pending
    }
  });

  let shopRes;
  try {
    shopRes = await ymyCreateOrder({
      goodsKey: pkg.goodsKey,
      channelId: input.channelId,
      contact,
      quantity: 1
    });
  } catch (err) {
    await prisma.guapiOrder.update({
      where: { id: order.id },
      data: {
        status: GuapiOrderStatus.closed,
        rawCreateResp: truncateJson({ error: String(err) })
      }
    });
    return { ok: false, message: "支付网关请求失败，请稍后重试" };
  }

  if (!shopRes.ok || !shopRes.tradeNo || !shopRes.payUrl) {
    await prisma.guapiOrder.update({
      where: { id: order.id },
      data: {
        status: GuapiOrderStatus.closed,
        rawCreateResp: truncateJson(shopRes.raw)
      }
    });
    return { ok: false, message: shopRes.msg || "下单失败" };
  }

  const totalAmount =
    shopRes.totalAmount != null && Number.isFinite(shopRes.totalAmount)
      ? new Prisma.Decimal(shopRes.totalAmount)
      : pkg.priceYuan;

  await prisma.guapiOrder.update({
    where: { id: order.id },
    data: {
      tradeNo: shopRes.tradeNo,
      payUrl: shopRes.payUrl,
      totalAmount,
      shopSessionCookie: shopRes.sessionCookie ?? null,
      rawCreateResp: truncateJson(shopRes.raw)
    }
  });

  return {
    ok: true,
    orderId: order.id,
    tradeNo: shopRes.tradeNo,
    payUrl: shopRes.payUrl,
    totalAmount: Number(totalAmount),
    channelId: input.channelId,
    channelName,
    guapiAmount: pkg.guapiAmount
  };
}

async function fulfillPaidOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.guapiOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status === GuapiOrderStatus.paid || order.fulfilledAt) {
      return false;
    }
    if (order.status !== GuapiOrderStatus.pending) {
      return false;
    }

    const now = new Date();
    const updated = await tx.guapiOrder.updateMany({
      where: { id: orderId, status: GuapiOrderStatus.pending, fulfilledAt: null },
      data: {
        status: GuapiOrderStatus.paid,
        paidAt: now,
        fulfilledAt: now
      }
    });
    if (updated.count !== 1) return false;

    await tx.guestUser.update({
      where: { id: order.guestUserId },
      data: { searchBonus: { increment: order.guapiAmount } }
    });
    await tx.smsGuapiLog.create({
      data: {
        guestUserId: order.guestUserId,
        amount: order.guapiAmount,
        type: "purchase",
        description: `购买瓜皮 ${order.guapiAmount}（订单 ${order.tradeNo || order.id}）`
      }
    });
    return true;
  });
}

export async function queryAndFulfillGuapiOrder(input: {
  tradeNo: string;
  guestUserId?: string | null;
  /** 管理员可查任意订单 */
  asAdmin?: boolean;
}): Promise<QueryGuapiOrderResult> {
  const tradeNo = input.tradeNo.trim();
  if (!tradeNo) return { ok: false, message: "缺少订单号" };

  const order = await prisma.guapiOrder.findUnique({ where: { tradeNo } });
  if (!order) return { ok: false, message: "订单不存在" };
  if (!input.asAdmin && input.guestUserId && order.guestUserId !== input.guestUserId) {
    return { ok: false, message: "订单不存在" };
  }

  if (order.status === GuapiOrderStatus.paid) {
    void grantCommissionsForGuapiOrder(order.id).catch((err) => {
      console.error("[guapi-pay] commission", err);
    });
    const quota = await getGuestGlobalSearchQuota(order.guestUserId);
    return {
      ok: true,
      status: order.status,
      paid: true,
      guapiAmount: order.guapiAmount,
      quota,
      message: "已支付并到账"
    };
  }

  if (order.status === GuapiOrderStatus.closed) {
    return {
      ok: true,
      status: order.status,
      paid: false,
      guapiAmount: order.guapiAmount,
      message: "订单已关闭"
    };
  }

  let shopQuery;
  try {
    shopQuery = await ymyQueryOrder(tradeNo, order.shopSessionCookie);
  } catch (err) {
    await prisma.guapiOrder.update({
      where: { id: order.id },
      data: { rawQueryResp: truncateJson({ error: String(err) }) }
    });
    return { ok: false, message: "查单失败，请稍后重试" };
  }

  await prisma.guapiOrder.update({
    where: { id: order.id },
    data: { rawQueryResp: truncateJson(shopQuery.raw) }
  });

  if (!shopQuery.paid) {
    return {
      ok: true,
      status: GuapiOrderStatus.pending,
      paid: false,
      guapiAmount: order.guapiAmount,
      message: shopQuery.msg || "未支付"
    };
  }

  await fulfillPaidOrder(order.id);
  void grantCommissionsForGuapiOrder(order.id).catch((err) => {
    console.error("[guapi-pay] commission", err);
  });
  const quota = await getGuestGlobalSearchQuota(order.guestUserId);
  return {
    ok: true,
    status: GuapiOrderStatus.paid,
    paid: true,
    guapiAmount: order.guapiAmount,
    quota,
    message: "支付成功，瓜皮已到账"
  };
}
