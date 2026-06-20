import { NextResponse } from "next/server";
import { requireSmsGuest } from "@/lib/sms-guest-auth";
import { smsGetBalance } from "@/lib/sms-user-handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSmsGuest();
  if (auth.error) return auth.error;
  const result = await smsGetBalance(auth.guestUserId!);
  return NextResponse.json({ code: 0, ...result });
}
