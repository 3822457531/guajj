import { getSocialUserSessionPayload } from "@/lib/social-auth";
import { prisma } from "@/lib/prisma";

export async function getLoggedInSocialUser() {
  const session = await getSocialUserSessionPayload();
  if (!session) return null;
  return prisma.socialUser.findUnique({ where: { id: session.socialUserId } });
}
