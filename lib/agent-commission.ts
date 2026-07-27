import { prisma } from "@/lib/prisma";
import { AgentCommissionLevel, Prisma } from "@/lib/generated/prisma";
import { floorToCent, getAgentRates } from "@/lib/agent-config";

/**
 * 瓜皮订单履约后发放直推/间推佣金。
 * 以 (guapiOrderId, level) 唯一约束防重复。
 */
export async function grantCommissionsForGuapiOrder(orderId: string) {
  const order = await prisma.guapiOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      guestUserId: true,
      totalAmount: true,
      status: true,
      fulfilledAt: true
    }
  });
  if (!order || order.status !== "paid" || !order.fulfilledAt) return;
  if (order.totalAmount == null || Number(order.totalAmount) <= 0) return;

  const orderAmount = Number(order.totalAmount);
  const rates = await getAgentRates();

  const buyer = await prisma.guestUser.findUnique({
    where: { id: order.guestUserId },
    select: { id: true, referrerId: true }
  });
  if (!buyer?.referrerId) return;

  const direct = await prisma.guestUser.findUnique({
    where: { id: buyer.referrerId },
    select: { id: true, isAgent: true, referrerId: true }
  });
  if (!direct) return;

  const grants: Array<{
    beneficiaryId: string;
    level: AgentCommissionLevel;
    rate: number;
  }> = [];

  if (direct.isAgent && direct.id !== buyer.id) {
    grants.push({
      beneficiaryId: direct.id,
      level: AgentCommissionLevel.direct,
      rate: rates.directRate
    });
  }

  if (direct.referrerId && direct.referrerId !== buyer.id && direct.referrerId !== direct.id) {
    const indirect = await prisma.guestUser.findUnique({
      where: { id: direct.referrerId },
      select: { id: true, isAgent: true }
    });
    if (indirect?.isAgent) {
      grants.push({
        beneficiaryId: indirect.id,
        level: AgentCommissionLevel.indirect,
        rate: rates.indirectRate
      });
    }
  }

  for (const g of grants) {
    const amount = floorToCent(orderAmount * g.rate);
    if (amount <= 0) continue;

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.agentCommission.findUnique({
          where: {
            guapiOrderId_level: { guapiOrderId: order.id, level: g.level }
          },
          select: { id: true }
        });
        if (existing) return;

        await tx.agentCommission.create({
          data: {
            beneficiaryId: g.beneficiaryId,
            fromGuestId: buyer.id,
            guapiOrderId: order.id,
            level: g.level,
            orderAmount: new Prisma.Decimal(orderAmount),
            rate: new Prisma.Decimal(g.rate),
            amount: new Prisma.Decimal(amount)
          }
        });
        await tx.guestUser.update({
          where: { id: g.beneficiaryId },
          data: { agentWalletYuan: { increment: amount } }
        });
      });
    } catch (err) {
      // 唯一约束冲突等视为已发过
      console.error("[agent-commission]", err);
    }
  }
}
