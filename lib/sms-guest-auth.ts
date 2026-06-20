import { NextResponse } from "next/server";
import { getGuestSessionPayload } from "@/lib/guest-auth";

export async function requireSmsGuest() {
  const session = await getGuestSessionPayload();
  if (!session?.guestUserId) {
    return {
      guestUserId: null as null,
      error: NextResponse.json(
        { ok: false, code: "GUEST_REQUIRED", message: "请先完成身份创建后再使用暗网手机号" },
        { status: 401 }
      )
    };
  }
  return { guestUserId: session.guestUserId, error: null };
}
