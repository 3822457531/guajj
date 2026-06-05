import { prisma } from "@/lib/prisma";

/** 与 @@unique([loginType, socialUid]) 对应，用于未登录评论 */
const ANONYMOUS_LOGIN_TYPE = "anonymous";
const ANONYMOUS_SOCIAL_UID = "__site_anonymous__";

export async function getOrCreateAnonymousSocialUser() {
  return prisma.socialUser.upsert({
    where: {
      loginType_socialUid: { loginType: ANONYMOUS_LOGIN_TYPE, socialUid: ANONYMOUS_SOCIAL_UID }
    },
    create: {
      socialUid: ANONYMOUS_SOCIAL_UID,
      loginType: ANONYMOUS_LOGIN_TYPE,
      nickname: "匿名",
      faceimg: ""
    },
    update: { nickname: "匿名" }
  });
}
