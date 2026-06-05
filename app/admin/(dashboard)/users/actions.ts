"use server";

import { adminPath } from "@/lib/admin-path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function deleteGuestUserAction(userId: string) {
  await requireAdmin();
  await prisma.guestUser.delete({ where: { id: userId } });
  revalidatePath(`${adminPath("/users")}`);
  redirect(`${adminPath("/users")}?deleted=1`);
}
