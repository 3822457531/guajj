import crypto from "crypto";
import { NextResponse } from "next/server";
import { createOAuthStateToken } from "@/lib/social-auth";
import { oauthFlowCookieAttrs } from "@/lib/social-oauth-cookie";
import { prisma } from "@/lib/prisma";
import { getPublicSiteOrigin } from "@/lib/site-public-origin";
import { fetchSuyanwLoginUrl, isSuyanwLoginType } from "@/lib/suyanw-oauth";

function safeReturnPath(raw: string | null): string {
  const v = (raw || "/").trim() || "/";
  if (!v.startsWith("/") || v.startsWith("//")) return "/";
  return v;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "";
  const returnPath = safeReturnPath(searchParams.get("return"));

  if (!isSuyanwLoginType(type)) {
    return NextResponse.json({ error: "不支持的登录方式" }, { status: 400 });
  }

  const origin = getPublicSiteOrigin(request);
  const redirectUri = process.env.SUYANW_REDIRECT_URI || `${origin}/api/auth/social/callback`;

  let loginUrl: string;
  try {
    loginUrl = await fetchSuyanwLoginUrl(type, redirectUri);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "登录配置错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await prisma.oAuthLoginState.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const stateId = crypto.randomBytes(20).toString("hex");
  await prisma.oAuthLoginState.create({
    data: {
      id: stateId,
      returnPath,
      oauthType: type,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15)
    }
  });

  const signed = createOAuthStateToken(returnPath, type);
  const flow = oauthFlowCookieAttrs(request);

  console.log(
    "[social/start]",
    JSON.stringify({
      loginType: type,
      returnPath,
      redirectUri,
      stateIdPrefix: `${stateId.slice(0, 10)}…`,
      cookiePolicy: flow.secure ? "SameSite=None; Secure" : "SameSite=Lax"
    })
  );

  const res = NextResponse.redirect(loginUrl);
  res.cookies.set("cg_oauth_sid", stateId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 15,
    ...flow
  });
  res.cookies.set("cg_oauth_state", signed, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 15,
    ...flow
  });
  return res;
}
