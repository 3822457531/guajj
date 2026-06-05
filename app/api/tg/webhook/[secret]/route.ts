import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processTelegramUpdate, type TelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const config = await prisma.telegramConfig.findUnique({ where: { webhookSecret: secret } });
  if (!config) {
    return NextResponse.json({ ok: false, message: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    enabled: config.isEnabled,
    channelId: config.channelId,
    channelName: config.channelName,
    message: config.isEnabled ? "Telegram webhook endpoint is ready for POST updates." : "Telegram config exists but is disabled."
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const config = await prisma.telegramConfig.findUnique({ where: { webhookSecret: secret } });
  if (!config?.isEnabled) return NextResponse.json({ ok: false }, { status: 404 });

  const update = (await request.json()) as TelegramUpdate;
  const result = await processTelegramUpdate(config, update);
  return NextResponse.json({ ok: true, result });
}
