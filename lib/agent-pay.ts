import { prisma } from "@/lib/prisma";
import { AgentOrderStatus, Prisma } from "@/lib/generated/prisma";
import {
  channelNameOf,
  getWechatChannelId,
  isAllowedPayChannel,
  PAY_CHANNEL_ALIPAY
} from "@/lib/pay-config";
import { truncateJson, ymyCreateOrder, ymyQueryOrder } from "@/lib/ymy-shop-pay";

export type CreateAgentOrderResult =
  | {
      ok: true;
      orderId: string;
      tradeNo: string;
      payUrl: string;
      totalAmount: number | null;
      channelId: number;
      channelName: string;
    }
  | { ok: false; message: string };

export type QueryAgentOrderResult =
  | {
      ok: true;
      status: AgentOrderStatus;
      paid: boolean;
      isAgent: boolean;
      message: string;
    }
  | { ok: false; message: string };

export async function listEnabledAgentPackages() {
  const wechatChannelId = await getWechatChannelId();
  const packages = await prisma.agentPackage.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, priceYuan: true, sortOrder: true }
  });
  return {
    packages: packages.map((p) => ({
      id: p.id,
      title: p.title,
      priceYuan: Number(p.priceYuan),
      sortOrder: p.sortOrder
    })),
    channels: [
      { id: PAY_CHANNEL_ALIPAY, name: "支付宝", kind: "alipay" as const },
      { id: wechatChannelId, name: "微信", kind: "wechat" as const }
    ]
  };
}

export async function createAgentOrderForGuest(input: {
  guestUserId: string;
  publicId: string;
  packageId: string;
  channelId: number;
}): Promise<CreateAgentOrderResult> {
  const guest = await prisma.guestUser.findUnique({
    where: { id: input.guestUserId },
    select: { id: true, isAgent: true }
  });
  if (!guest) return { ok: false, message: "用户不存在" };
  if (guest.isAgent) return { ok: false, message: "你已是代理，无需重复开通" };

  const wechatDefault = await getWechatChannelId();
  if (!isAllowedPayChannel(input.channelId, wechatDefault)) {
    return { ok: false, message: "不支持的支付渠道" };
  }

  const pkg = await prisma.agentPackage.findFirst({
    where: { id: input.packageId, enabled: true }
  });
  if (!pkg) return { ok: false, message: "套餐不存在或已下架" };

  const channelName = channelNameOf(input.channelId);
  const contact = input.publicId;

  const order = await prisma.agentOrder.create({
    data: {
      guestUserId: input.guestUserId,
      packageId: pkg.id,
      channelId: input.channelId,
      channelName,
      contact,
      status: AgentOrderStatus.pending
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
    await prisma.agentOrder.update({
      where: { id: order.id },
      data: {
        status: AgentOrderStatus.closed,
        rawCreateResp: truncateJson({ error: String(err) })
      }
    });
    return { ok: false, message: "支付网关请求失败，请稍后重试" };
  }

  if (!shopRes.ok || !shopRes.tradeNo || !shopRes.payUrl) {
    await prisma.agentOrder.update({
      where: { id: order.id },
      data: {
        status: AgentOrderStatus.closed,
        rawCreateResp: truncateJson(shopRes.raw)
      }
    });
    return { ok: false, message: shopRes.msg || "下单失败" };
  }

  const totalAmount =
    shopRes.totalAmount != null && Number.isFinite(shopRes.totalAmount)
      ? new Prisma.Decimal(shopRes.totalAmount)
      : pkg.priceYuan;

  await prisma.agentOrder.update({
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
    channelName
  };
}

async function fulfillAgentOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.agentOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== AgentOrderStatus.pending || order.fulfilledAt) {
      return false;
    }

    const now = new Date();
    const updated = await tx.agentOrder.updateMany({
      where: { id: orderId, status: AgentOrderStatus.pending, fulfilledAt: null },
      data: {
        status: AgentOrderStatus.paid,
        paidAt: now,
        fulfilledAt: now
      }
    });
    if (updated.count !== 1) return false;

    await tx.guestUser.update({
      where: { id: order.guestUserId },
      data: { isAgent: true, agentAt: now }
    });
    return true;
  });
}

export async function queryAndFulfillAgentOrder(input: {
  tradeNo: string;
  guestUserId?: string | null;
  asAdmin?: boolean;
}): Promise<QueryAgentOrderResult> {
  const tradeNo = input.tradeNo.trim();
  if (!tradeNo) return { ok: false, message: "缺少订单号" };

  const order = await prisma.agentOrder.findUnique({ where: { tradeNo } });
  if (!order) return { ok: false, message: "订单不存在" };
  if (!input.asAdmin && input.guestUserId && order.guestUserId !== input.guestUserId) {
    return { ok: false, message: "订单不存在" };
  }

  const guest = await prisma.guestUser.findUnique({
    where: { id: order.guestUserId },
    select: { isAgent: true }
  });

  if (order.status === AgentOrderStatus.paid) {
    return {
      ok: true,
      status: order.status,
      paid: true,
      isAgent: Boolean(guest?.isAgent),
      message: "已支付，代理已开通"
    };
  }

  if (order.status === AgentOrderStatus.closed) {
    return {
      ok: true,
      status: order.status,
      paid: false,
      isAgent: Boolean(guest?.isAgent),
      message: "订单已关闭"
    };
  }

  let shopQuery;
  try {
    shopQuery = await ymyQueryOrder(tradeNo, order.shopSessionCookie);
  } catch (err) {
    await prisma.agentOrder.update({
      where: { id: order.id },
      data: { rawQueryResp: truncateJson({ error: String(err) }) }
    });
    return { ok: false, message: "查单失败，请稍后重试" };
  }

  await prisma.agentOrder.update({
    where: { id: order.id },
    data: { rawQueryResp: truncateJson(shopQuery.raw) }
  });

  if (!shopQuery.paid) {
    return {
      ok: true,
      status: AgentOrderStatus.pending,
      paid: false,
      isAgent: Boolean(guest?.isAgent),
      message: shopQuery.msg || "未支付"
    };
  }

  await fulfillAgentOrder(order.id);
  return {
    ok: true,
    status: AgentOrderStatus.paid,
    paid: true,
    isAgent: true,
    message: "支付成功，代理已开通"
  };
}
