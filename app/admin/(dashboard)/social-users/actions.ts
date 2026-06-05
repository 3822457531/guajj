"use server";

import { adminPath } from "@/lib/admin-path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function deleteSocialUserAction(userId: string) {
  await requireAdmin();
  const posts = await prisma.comment.findMany({
    where: { authorId: userId },
    select: { postId: true },
    distinct: ["postId"]
  });
  await prisma.socialUser.delete({ where: { id: userId } });
  revalidatePath(`${adminPath("/social-users")}`);
  revalidatePath(`${adminPath("/comments")}`);
  for (const p of posts) {
    revalidatePath(`/post/${p.postId}`);
  }
  redirect(`${adminPath("/social-users")}?deleted=1`);
}
