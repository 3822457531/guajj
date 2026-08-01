"use server";

import { adminPath } from "@/lib/admin-path";
import { requireAdmin } from "@/lib/auth";
import { deleteStorageObjectsWithIndex } from "@/lib/delete-storage-with-index";
import { normalizeObjectKey } from "@/lib/media-storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function storageAdminPath(query = "") {
  return `${adminPath("/storage")}${query ? `?${query}` : ""}`;
}

function buildDeleteQuery(result: Awaited<ReturnType<typeof deleteStorageObjectsWithIndex>>, extra?: { key?: string }) {
  const params = new URLSearchParams();
  params.set("deleted", String(result.mediaDeleted));
  if (result.indexDeleted > 0) params.set("indexDeleted", String(result.indexDeleted));
  if (result.homeIndexKeys > 0) params.set("homeKeys", String(result.homeIndexKeys));
  if (result.searchKeys > 0) params.set("searchKeys", String(result.searchKeys));
  if (result.mediaFailed > 0) params.set("mediaFailed", String(result.mediaFailed));
  if (extra?.key) params.set("key", extra.key);
  return params.toString();
}

export async function deleteStorageObjectAction(key: string) {
  await requireAdmin();
  const normalized = normalizeObjectKey(key);
  if (!normalized) {
    redirect(storageAdminPath("error=invalid_key"));
  }

  const result = await deleteStorageObjectsWithIndex([normalized]);
  revalidatePath(storageAdminPath());
  revalidatePath(adminPath("/index-messages"));
  revalidatePath("/");

  if (result.mediaDeleted === 0 && result.indexDeleted === 0) {
    redirect(storageAdminPath(`error=delete_failed&key=${encodeURIComponent(normalized)}`));
  }

  redirect(storageAdminPath(buildDeleteQuery(result, { key: normalized })));
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

  const result = await deleteStorageObjectsWithIndex(keys);
  revalidatePath(storageAdminPath());
  revalidatePath(adminPath("/index-messages"));
  revalidatePath("/");
  redirect(storageAdminPath(buildDeleteQuery(result)));
}
