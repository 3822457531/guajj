"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LEN = 8;

export async function changeAdminPasswordAction(formData: FormData) {
  const session = await requireAdmin();
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const settingsPath = adminPath("/settings");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect(`${settingsPath}?pwd=missing`);
  }
  if (newPassword.length < MIN_PASSWORD_LEN) {
    redirect(`${settingsPath}?pwd=short`);
  }
  if (newPassword !== confirmPassword) {
    redirect(`${settingsPath}?pwd=mismatch`);
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.userId } });
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    redirect(`${settingsPath}?pwd=wrong`);
  }

  await prisma.adminUser.update({
    where: { id: session.userId },
    data: { passwordHash: hashPassword(newPassword) }
  });

  revalidatePath("/admin/settings");
  redirect(`${settingsPath}?pwd=ok`);
}
