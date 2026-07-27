import { getGuestSessionPayload } from "@/lib/guest-auth";
import { prisma } from "@/lib/prisma";
import { getAgentRates } from "@/lib/agent-config";
import { AgentCommissionLevel } from "@/lib/generated/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getGuestSessionPayload();
  if (!session) {
    return Response.json({ ok: false, message: "请先获取匿名身份" }, { status: 401 });
  }

  const guest = await prisma.guestUser.findUnique({
    where: { id: session.guestUserId },
    select: {
      id: true,
      publicId: true,
      isAgent: true,
      agentAt: true,
      agentWalletYuan: true
    }
  });
  if (!guest) {
    return Response.json({ ok: false, message: "身份无效" }, { status: 401 });
  }

  const rates = await getAgentRates();
  const directIds = await prisma.guestUser.findMany({
    where: { referrerId: guest.id },
    select: { id: true }
  });
  const directCount = directIds.length;
  const indirectCount =
    directIds.length === 0
      ? 0
      : await prisma.guestUser.count({
          where: { referrerId: { in: directIds.map((d) => d.id) } }
        });

  const [directCommission, indirectCommission] = await Promise.all([
    prisma.agentCommission.aggregate({
      where: { beneficiaryId: guest.id, level: AgentCommissionLevel.direct },
      _sum: { amount: true }
    }),
    prisma.agentCommission.aggregate({
      where: { beneficiaryId: guest.id, level: AgentCommissionLevel.indirect },
      _sum: { amount: true }
    })
  ]);

  return Response.json({
    ok: true,
    publicId: guest.publicId,
    isAgent: guest.isAgent,
    agentAt: guest.agentAt?.toISOString() ?? null,
    walletYuan: Number(guest.agentWalletYuan),
    rates: {
      directRate: rates.directRate,
      indirectRate: rates.indirectRate,
      minWithdrawYuan: rates.minWithdrawYuan
    },
    stats: {
      directCount,
      indirectCount,
      directCommissionYuan: Number(directCommission._sum.amount ?? 0),
      indirectCommissionYuan: Number(indirectCommission._sum.amount ?? 0)
    }
  });
}
