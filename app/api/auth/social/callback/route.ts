import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSocialUserSessionToken, readOAuthStateToken } from "@/lib/social-auth";
import { oauthFlowCookieAttrs } from "@/lib/social-oauth-cookie";
import { prisma } from "@/lib/prisma";
import { getPublicSiteOrigin } from "@/lib/site-public-origin";
import { fetchSuyanwUserByCode, isSuyanwLoginType } from "@/lib/suyanw-oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "";
  const code = searchParams.get("code") || "";
  const providerState = searchParams.get("state") || "";

  const origin = getPublicSiteOrigin(request);
  const flow = oauthFlowCookieAttrs(request);

  const failRedirect = (msg: string, debug?: Record<string, unknown>) => {
    console.warn(
      "[social/callback] fail",
      JSON.stringify({
        msg,
        queryType: type,
        codeLength: code.length,
        providerStateEmpty: !providerState,
        ...debug
      })
    );
    const res = NextResponse.redirect(`${origin}/?error=${encodeURIComponent(msg)}`);
    res.cookies.delete("cg_oauth_sid");
    res.cookies.delete("cg_oauth_state");
    return res;
  };

  if (!code || !isSuyanwLoginType(type)) {
    return failRedirect("登录参数无效", { reason: "missing_code_or_bad_type" });
  }

  await prisma.oAuthLoginState.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const jar = await cookies();
  const sid = jar.get("cg_oauth_sid")?.value;
  const signedRaw = jar.get("cg_oauth_state")?.value;
  const signedParsed = readOAuthStateToken(signedRaw);

  let returnPath: string | null = null;

  if (sid) {
    const row = await prisma.oAuthLoginState.findUnique({ where: { id: sid } });
    const rowOk = row && row.expiresAt >= new Date() && row.oauthType === type;
    if (rowOk) {
      returnPath = row.returnPath;
      await prisma.oAuthLoginState.delete({ where: { id: sid } }).catch(() => {});
    }
  }

  if (!returnPath && signedParsed && signedParsed.oauthType === type) {
    returnPath = signedParsed.returnPath;
  }

  console.log(
    "[social/callback] state",
    JSON.stringify({
      queryType: type,
      codeLength: code.length,
      providerStateLength: providerState.length,
      origin,
      requestUrlOrigin: new URL(request.url).origin,
      hasSidCookie: Boolean(sid),
      sidPrefix: sid ? `${sid.slice(0, 8)}…` : null,
      hasSignedCookie: Boolean(signedRaw),
      signedParsedOk: Boolean(signedParsed),
      signedTypeMatch: signedParsed ? signedParsed.oauthType === type : false,
      dbOrCookieResolved: Boolean(returnPath),
      cookiePolicy: flow.secure ? "none+secure" : "lax"
    })
  );

  if (!returnPath) {
    return failRedirect("登录状态已过期，请重试", {
      reason: "no_return_path",
      signedExpiredOrMismatch: Boolean(signedRaw) && !signedParsed
    });
  }

  let profile: Awaited<ReturnType<typeof fetchSuyanwUserByCode>>;
  try {
    profile = await fetchSuyanwUserByCode(type, code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "登录失败";
    return failRedirect(msg, { reason: "suyanw_callback_api" });
  }

  console.log(
    "[social/callback] profile",
    JSON.stringify({
      type: profile.type,
      socialUid: `${profile.socialUid.slice(0, 6)}…${profile.socialUid.slice(-4)}`,
      nickname: profile.nickname,
      hasFace: Boolean(profile.faceimg),
      gender: profile.gender || "",
      location: profile.location || ""
    })
  );

  const now = new Date();
  const user = await prisma.socialUser.upsert({
    where: { loginType_socialUid: { loginType: profile.type, socialUid: profile.socialUid } },
    create: {
      loginType: profile.type,
      socialUid: profile.socialUid,
      nickname: profile.nickname,
      faceimg: profile.faceimg,
      gender: profile.gender,
      location: profile.location,
      lastLoginAt: now
    },
    update: {
      nickname: profile.nickname,
      faceimg: profile.faceimg,
      gender: profile.gender,
      location: profile.location,
      lastLoginAt: now
    }
  });

  console.log(
    "[social/callback] session",
    JSON.stringify({ socialUserId: `${user.id.slice(0, 8)}…`, returnPath })
  );

  const session = createSocialUserSessionToken(user.id);
  const target = new URL(returnPath, origin).toString();
  const res = NextResponse.redirect(target);
  res.cookies.set("cg_social_user", session, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  res.cookies.delete("cg_oauth_sid");
  res.cookies.delete("cg_oauth_state");
  return res;
}
