import { getGuestSessionPayload } from "@/lib/guest-auth";
import { submitAgentWithdrawal } from "@/lib/agent-withdraw";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getGuestSessionPayload();
  if (!session) {
    return Response.json({ ok: false, message: "请先获取匿名身份" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const size = Math.min(50, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
  const skip = (page - 1) * size;

  const where = { guestUserId: session.guestUserId };
  const [list, total] = await Promise.all([
    prisma.agentWithdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size
    }),
    prisma.agentWithdrawal.count({ where })
  ]);

  return Response.json({
    ok: true,
    total,
    page,
    size,
    items: list.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      channel: row.channel,
      account: row.account,
      accountName: row.accountName,
      status: row.status,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null
    }))
  });
}

export async function POST(req: Request) {
  const session = await getGuestSessionPayload();
  if (!session) {
    return Response.json({ ok: false, message: "请先获取匿名身份" }, { status: 401 });
  }

  let body: {
    amount?: number;
    channel?: string;
    account?: string;
    accountName?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const channel = body.channel === "wechat" ? "wechat" : body.channel === "alipay" ? "alipay" : null;
  if (!channel) {
    return Response.json({ ok: false, message: "请选择提现渠道" }, { status: 400 });
  }

  const result = await submitAgentWithdrawal({
    guestUserId: session.guestUserId,
    amount: Number(body.amount),
    channel,
    account: String(body.account || ""),
    accountName: body.accountName ? String(body.accountName) : undefined
  });

  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 400 });
  }

  return Response.json({ ok: true, id: result.id, message: "提现申请已提交" });
}
