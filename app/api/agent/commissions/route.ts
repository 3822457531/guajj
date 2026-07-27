import { getGuestSessionPayload } from "@/lib/guest-auth";
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

  const where = { beneficiaryId: session.guestUserId };
  const [list, total] = await Promise.all([
    prisma.agentCommission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: { fromGuest: { select: { publicId: true } } }
    }),
    prisma.agentCommission.count({ where })
  ]);

  return Response.json({
    ok: true,
    total,
    page,
    size,
    items: list.map((row) => ({
      id: row.id,
      level: row.level,
      amount: Number(row.amount),
      orderAmount: Number(row.orderAmount),
      rate: Number(row.rate),
      fromPublicId: row.fromGuest.publicId,
      createdAt: row.createdAt.toISOString()
    }))
  });
}
