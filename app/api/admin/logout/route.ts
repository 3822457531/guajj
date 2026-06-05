import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/auth";

const COOKIE_NAME = "cg_admin";

export async function POST() {
  await clearAdminCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
