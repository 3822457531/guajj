import { prisma } from "@/lib/prisma";
import {
  AgentWithdrawChannel,
  AgentWithdrawStatus,
  Prisma
} from "@/lib/generated/prisma";
import { floorToCent, getAgentRates } from "@/lib/agent-config";

export async function submitAgentWithdrawal(input: {
  guestUserId: string;
  amount: number;
  channel: "alipay" | "wechat";
  account: string;
  accountName?: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const guest = await prisma.guestUser.findUnique({
    where: { id: input.guestUserId },
    select: { id: true, isAgent: true, agentWalletYuan: true }
  });
  if (!guest?.isAgent) return { ok: false, message: "请先开通代理" };

  const amount = floorToCent(Number(input.amount));
  if (amount <= 0) return { ok: false, message: "提现金额无效" };

  const rates = await getAgentRates();
  if (amount < rates.minWithdrawYuan) {
    return { ok: false, message: `最低提现 ${rates.minWithdrawYuan} 元` };
  }

  const account = String(input.account || "").trim();
  if (!account || account.length > 128) {
    return { ok: false, message: "请填写收款账号" };
  }
  const accountName = String(input.accountName || "").trim() || null;
  const channel =
    input.channel === "wechat" ? AgentWithdrawChannel.wechat : AgentWithdrawChannel.alipay;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const fresh = await tx.guestUser.findUnique({
        where: { id: guest.id },
        select: { agentWalletYuan: true, isAgent: true }
      });
      if (!fresh?.isAgent) throw new Error("NOT_AGENT");
      const wallet = Number(fresh.agentWalletYuan);
      if (wallet + 1e-9 < amount) throw new Error("INSUFFICIENT");

      await tx.guestUser.update({
        where: { id: guest.id },
        data: { agentWalletYuan: { decrement: amount } }
      });

      return tx.agentWithdrawal.create({
        data: {
          guestUserId: guest.id,
          amount: new Prisma.Decimal(amount),
          channel,
          account,
          accountName,
          status: AgentWithdrawStatus.pending
        }
      });
    });
    return { ok: true, id: row.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INSUFFICIENT") return { ok: false, message: "余额不足" };
    if (msg === "NOT_AGENT") return { ok: false, message: "请先开通代理" };
    console.error("[agent-withdraw]", err);
    return { ok: false, message: "提现申请失败" };
  }
}

export async function reviewAgentWithdrawal(input: {
  id: string;
  approve: boolean;
  adminNote?: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const note = String(input.adminNote || "").trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.agentWithdrawal.findUnique({ where: { id: input.id } });
      if (!row) throw new Error("NOT_FOUND");
      if (row.status !== AgentWithdrawStatus.pending) throw new Error("NOT_PENDING");

      if (input.approve) {
        await tx.agentWithdrawal.update({
          where: { id: row.id },
          data: {
            status: AgentWithdrawStatus.approved,
            adminNote: note,
            reviewedAt: new Date()
          }
        });
        return;
      }

      await tx.guestUser.update({
        where: { id: row.guestUserId },
        data: { agentWalletYuan: { increment: Number(row.amount) } }
      });
      await tx.agentWithdrawal.update({
        where: { id: row.id },
        data: {
          status: AgentWithdrawStatus.rejected,
          adminNote: note,
          reviewedAt: new Date()
        }
      });
    });
    return { ok: true, message: input.approve ? "已通过" : "已拒绝并退回余额" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") return { ok: false, message: "提现单不存在" };
    if (msg === "NOT_PENDING") return { ok: false, message: "该单已处理" };
    console.error("[agent-withdraw-review]", err);
    return { ok: false, message: "审核失败" };
  }
}
