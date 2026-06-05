import { NextResponse } from "next/server";
import { REF_COOKIE, refCookieOptions } from "@/lib/guest-auth";
import { findGuestByPublicId, isValidPublicId } from "@/lib/guest-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let ref = "";
  try {
    const body = await request.json();
    ref = typeof body.ref === "string" ? body.ref.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (!ref || !isValidPublicId(ref)) {
    return NextResponse.json({ ok: false, error: "invalid_ref" }, { status: 400 });
  }

  const referrer = await findGuestByPublicId(ref);
  if (!referrer) {
    return NextResponse.json({ ok: false, error: "ref_not_found" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, ref: referrer.publicId });
  response.cookies.set(REF_COOKIE, referrer.publicId, refCookieOptions());
  return response;
}
