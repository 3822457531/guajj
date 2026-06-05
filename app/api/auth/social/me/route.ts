import { NextResponse } from "next/server";
import { getLoggedInSocialUser } from "@/lib/social-user";

export async function GET() {
  const user = await getLoggedInSocialUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      faceimg: user.faceimg,
      loginType: user.loginType
    }
  });
}
