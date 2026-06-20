import { NextResponse } from "next/server";
import { requireSmsGuest } from "@/lib/sms-guest-auth";
import { smsFetchSms } from "@/lib/sms-user-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSmsGuest();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const phone = (searchParams.get("phone") || "").trim();
  const keyword = (searchParams.get("keyword") || "").trim();

  try {
    const result = await smsFetchSms(auth.guestUserId!, phone, keyword);
    if ("code" in result && result.code === 402) {
      return NextResponse.json(result, { status: 402 });
    }
    if ("ok" in result && result.ok === false && "code" in result) {
      return NextResponse.json(result, { status: Number(result.code) || 500 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { code: 500, msg: err instanceof Error ? err.message : "获取失败" },
      { status: 500 }
    );
  }
}
