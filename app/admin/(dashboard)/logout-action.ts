"use server";

import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { clearAdminCookie } from "@/lib/auth";

export async function adminLogoutAction() {
  await clearAdminCookie();
  redirect(adminPath("/login"));
}
