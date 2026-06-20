import { NextResponse } from "next/server";
import { requireSmsGuest } from "@/lib/sms-guest-auth";
import { smsReleaseNumber } from "@/lib/sms-user-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireSmsGuest();
  if (auth.error) return auth.error;

  let phone = "";
  try {
    const body = (await request.json()) as { phone?: string };
    phone = (body?.phone || "").trim();
  } catch {
    /* empty */
  }
  if (!phone) {
    const { searchParams } = new URL(request.url);
    phone = (searchParams.get("phone") || "").trim();
  }

  try {
    const result = await smsReleaseNumber(auth.guestUserId!, phone);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { code: 500, msg: err instanceof Error ? err.message : "释放失败" },
      { status: 500 }
    );
  }
}
