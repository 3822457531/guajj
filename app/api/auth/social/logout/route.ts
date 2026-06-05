import { NextResponse } from "next/server";

function safeNext(next: string | null) {
  const v = (next || "/").trim() || "/";
  if (!v.startsWith("/") || v.startsWith("//")) return "/";
  return v;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const res = NextResponse.json({ ok: true, redirect: safeNext(searchParams.get("next")) });
  res.cookies.delete("cg_social_user");
  return res;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = new URL(safeNext(searchParams.get("next")), request.url).toString();
  const res = NextResponse.redirect(target);
  res.cookies.delete("cg_social_user");
  return res;
}
