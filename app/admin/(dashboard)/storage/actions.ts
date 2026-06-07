"use server";

import { adminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/auth";
import { deleteMediaObjectKey, deleteMediaObjectKeys, normalizeObjectKey } from "@/lib/media-storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function storageAdminPath(query = "") {
  return `${adminPath("/storage")}${query ? `?${query}` : ""}`;
}

export async function deleteStorageObjectAction(key: string) {
  await requireAdmin();
  const normalized = normalizeObjectKey(key);
  if (!normalized) {
    redirect(storageAdminPath("error=invalid_key"));
  }

  const result = await deleteMediaObjectKey(normalized);
  revalidatePath(storageAdminPath());

  if (!result.ok) {
    redirect(storageAdminPath(`error=delete_failed&key=${encodeURIComponent(normalized)}`));
  }

  redirect(storageAdminPath(`deleted=1&key=${encodeURIComponent(normalized)}`));
}

export async function batchDeleteStorageObjectsAction(formData: FormData) {
  await requireAdmin();
  const keys = formData
    .getAll("keys")
    .map(String)
    .map((k) => normalizeObjectKey(k))
    .filter(Boolean) as string[];

  if (keys.length === 0) {
    redirect(storageAdminPath("error=empty"));
  }

  const results = await deleteMediaObjectKeys(keys);
  const okCount = results.filter((r) => r.ok).length;
  revalidatePath(storageAdminPath());
  redirect(storageAdminPath(`deleted=${okCount}`));
}
