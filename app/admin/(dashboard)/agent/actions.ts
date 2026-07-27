"use server";

import { adminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/auth";
import { getAgentRates, setAgentRates } from "@/lib/agent-config";
import { queryAndFulfillAgentOrder } from "@/lib/agent-pay";
import { reviewAgentWithdrawal } from "@/lib/agent-withdraw";
import { prisma } from "@/lib/prisma";
import {
  AgentOrderStatus,
  AgentWithdrawStatus,
  Prisma
} from "@/lib/generated/prisma";
import { revalidatePath } from "next/cache";

function revalidateAgent() {
  revalidatePath(`${adminPath("/agent")}`);
}

export async function getAgentAdminSnapshot() {
  await requireAdmin();
  const [rates, packages, orderTotal, paidOrderTotal, pendingWithdraw, commissionTotal] =
    await Promise.all([
      getAgentRates(),
      prisma.agentPackage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
      prisma.agentOrder.count(),
      prisma.agentOrder.count({ where: { status: AgentOrderStatus.paid } }),
      prisma.agentWithdrawal.count({ where: { status: AgentWithdrawStatus.pending } }),
      prisma.agentCommission.count()
    ]);

  return {
    rates,
    packages: packages.map((p) => ({ ...p, priceYuan: Number(p.priceYuan) })),
    orderTotal,
    paidOrderTotal,
    pendingWithdraw,
    commissionTotal
  };
}

export async function saveAgentRatesAction(formData: FormData) {
  await requireAdmin();
  const directPct = Number(formData.get("directPct"));
  const indirectPct = Number(formData.get("indirectPct"));
  const minWithdrawYuan = Number(formData.get("minWithdrawYuan"));
  if (!Number.isFinite(directPct) || !Number.isFinite(indirectPct) || !Number.isFinite(minWithdrawYuan)) {
    return { ok: false, message: "请填写有效数字" };
  }
  await setAgentRates({
    directRate: directPct / 100,
    indirectRate: indirectPct / 100,
    minWithdrawYuan
  });
  revalidateAgent();
  return { ok: true, message: "比例已保存" };
}

export async function upsertAgentPackageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const goodsKey = String(formData.get("goodsKey") || "").trim();
  const priceYuan = Number(formData.get("priceYuan"));
  const sortOrder = Math.round(Number(formData.get("sortOrder") || 0));
  const enabled = String(formData.get("enabled") || "") === "1" || String(formData.get("enabled")) === "on";

  if (!title || !goodsKey) return { ok: false, message: "请填写标题与 goods_key" };
  if (!Number.isFinite(priceYuan) || priceYuan < 0) return { ok: false, message: "请填写有效标价" };

  const data = {
    title,
    goodsKey,
    priceYuan: new Prisma.Decimal(priceYuan),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    enabled
  };

  if (id) {
    const exists = await prisma.agentPackage.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return { ok: false, message: "套餐不存在" };
    await prisma.agentPackage.update({ where: { id }, data });
  } else {
    await prisma.agentPackage.create({ data });
  }
  revalidateAgent();
  return { ok: true, message: id ? "套餐已更新" : "套餐已创建" };
}

export async function deleteAgentPackageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, message: "缺少套餐 ID" };
  const orderCount = await prisma.agentOrder.count({ where: { packageId: id } });
  if (orderCount > 0) {
    await prisma.agentPackage.update({ where: { id }, data: { enabled: false } });
    revalidateAgent();
    return { ok: true, message: "套餐已有订单，已改为下架" };
  }
  await prisma.agentPackage.delete({ where: { id } });
  revalidateAgent();
  return { ok: true, message: "套餐已删除" };
}

export async function toggleAgentPackageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const enabled = String(formData.get("enabled") || "") === "1";
  if (!id) return { ok: false, message: "缺少套餐 ID" };
  await prisma.agentPackage.update({ where: { id }, data: { enabled } });
  revalidateAgent();
  return { ok: true, message: enabled ? "已上架" : "已下架" };
}

export async function getAgentOrdersPage(input: {
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
  const where: Prisma.AgentOrderWhereInput = {};
  if (input.status === "pending" || input.status === "paid" || input.status === "closed") {
    where.status = input.status;
  }
  if (input.tradeNo?.trim()) where.tradeNo = { contains: input.tradeNo.trim() };
  if (input.publicId?.trim()) {
    where.guestUser = { publicId: { contains: input.publicId.trim() } };
  }

  const [list, total] = await Promise.all([
    prisma.agentOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: {
        guestUser: { select: { publicId: true, isAgent: true } },
        package: { select: { title: true, goodsKey: true } }
      }
    }),
    prisma.agentOrder.count({ where })
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

export async function adminQueryAgentOrderAction(formData: FormData) {
  await requireAdmin();
  const tradeNo = String(formData.get("tradeNo") || "").trim();
  if (!tradeNo) return { ok: false, message: "缺少订单号" };
  const result = await queryAndFulfillAgentOrder({ tradeNo, asAdmin: true });
  revalidateAgent();
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: result.paid ? "已开通代理" : result.message };
}

export async function getAgentWithdrawalsPage(input: {
  page: number;
  size: number;
  status?: string;
  publicId?: string;
}) {
  await requireAdmin();
  const page = Math.max(1, input.page);
  const size = Math.min(50, Math.max(1, input.size));
  const skip = (page - 1) * size;
  const where: Prisma.AgentWithdrawalWhereInput = {};
  if (input.status === "pending" || input.status === "approved" || input.status === "rejected") {
    where.status = input.status;
  }
  if (input.publicId?.trim()) {
    where.guestUser = { publicId: { contains: input.publicId.trim() } };
  }

  const [list, total] = await Promise.all([
    prisma.agentWithdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: { guestUser: { select: { publicId: true } } }
    }),
    prisma.agentWithdrawal.count({ where })
  ]);

  return {
    list: list.map((row) => ({
      ...row,
      amount: Number(row.amount)
    })),
    total,
    page,
    size
  };
}

export async function reviewWithdrawalAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const approve = String(formData.get("approve") || "") === "1";
  const adminNote = String(formData.get("adminNote") || "").trim();
  if (!id) return { ok: false, message: "缺少提现单 ID" };
  const result = await reviewAgentWithdrawal({ id, approve, adminNote });
  revalidateAgent();
  return result;
}

export async function getAgentCommissionsPage(page: number, size: number) {
  await requireAdmin();
  const p = Math.max(1, page);
  const s = Math.min(50, Math.max(1, size));
  const skip = (p - 1) * s;
  const [list, total] = await Promise.all([
    prisma.agentCommission.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: s,
      include: {
        beneficiary: { select: { publicId: true } },
        fromGuest: { select: { publicId: true } }
      }
    }),
    prisma.agentCommission.count()
  ]);
  return {
    list: list.map((row) => ({
      ...row,
      amount: Number(row.amount),
      orderAmount: Number(row.orderAmount),
      rate: Number(row.rate)
    })),
    total,
    page: p,
    size: s
  };
}
