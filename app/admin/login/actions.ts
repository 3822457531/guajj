"use server";

import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setAdminCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const user = await prisma.adminUser.findUnique({ where: { username } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect(`${adminPath("/login")}?error=1`);
  }

  await setAdminCookie(createSessionToken(user.id));
  redirect(adminPath());
}
