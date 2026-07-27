import { getGuestSessionPayload } from "@/lib/guest-auth";
import { createAgentOrderForGuest } from "@/lib/agent-pay";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getGuestSessionPayload();
  if (!session) {
    return Response.json({ ok: false, message: "请先获取匿名身份" }, { status: 401 });
  }

  const guest = await prisma.guestUser.findUnique({
    where: { id: session.guestUserId },
    select: { id: true, publicId: true }
  });
  if (!guest) {
    return Response.json({ ok: false, message: "身份无效，请重新注册" }, { status: 401 });
  }

  let body: { packageId?: string; channelId?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const packageId = String(body.packageId || "").trim();
  const channelId = Number(body.channelId);
  if (!packageId || !Number.isFinite(channelId)) {
    return Response.json({ ok: false, message: "请选择套餐与支付方式" }, { status: 400 });
  }

  const result = await createAgentOrderForGuest({
    guestUserId: guest.id,
    publicId: guest.publicId,
    packageId,
    channelId
  });

  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 400 });
  }

  return Response.json({
    ok: true,
    orderId: result.orderId,
    tradeNo: result.tradeNo,
    payUrl: result.payUrl,
    totalAmount: result.totalAmount,
    channelId: result.channelId,
    channelName: result.channelName
  });
}
