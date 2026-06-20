import { NextResponse } from "next/server";
import { smsGetPricingPublic } from "@/lib/sms-user-handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await smsGetPricingPublic();
  return NextResponse.json({ code: 0, ...result });
}
