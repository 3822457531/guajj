import { NextResponse } from "next/server";
import { requireSmsGuest } from "@/lib/sms-guest-auth";
import { smsGetHistory } from "@/lib/sms-user-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSmsGuest();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const size = Math.min(50, Math.max(1, parseInt(searchParams.get("size") || "20", 10)));
  const result = await smsGetHistory(auth.guestUserId!, page, size);
  return NextResponse.json(result);
}
