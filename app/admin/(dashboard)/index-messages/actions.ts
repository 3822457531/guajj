"use server";

import { adminPath } from "@/lib/admin-path";
import { TgIndexContentType } from "@/lib/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { deleteIndexMessagesWithMedia } from "@/lib/delete-index-messages";
import { prisma } from "@/lib/prisma";

function readIndexForm(formData: FormData) {
  const contentType = String(formData.get("contentType") || "TEXT");
  return {
    title: String(formData.get("title") || "").trim(),
    snippet: String(formData.get("snippet") || "").trim(),
    rawText: String(formData.get("rawText") || "").trim(),
    contentType: Object.values(TgIndexContentType).includes(contentType as TgIndexContentType)
      ? (contentType as TgIndexContentType)
      : TgIndexContentType.TEXT,
    mediaUrl: String(formData.get("mediaUrl") || "").trim() || null,
    galleryImageUrls: String(formData.get("galleryImageUrls") || "").trim() || null,
    galleryVideoUrls: String(formData.get("galleryVideoUrls") || "").trim() || null,
    contentBlocks: String(formData.get("contentBlocks") || "").trim() || null,
    sourceTitle: String(formData.get("sourceTitle") || "").trim() || null,
    sourceUsername: String(formData.get("sourceUsername") || "").trim() || null,
    durationSec: Math.max(0, Math.floor(Number(formData.get("durationSec")) || 0)) || null,
    isPinned: formData.get("isPinned") === "on",
    heat: Math.max(0, Math.floor(Number(formData.get("heat")) || 0)),
    views: Math.max(0, Math.floor(Number(formData.get("views")) || 0))
  };
}

function validateIndex(data: ReturnType<typeof readIndexForm>) {
  return data.title && data.snippet;
}

function revalidateIndexPaths(id?: string) {
  revalidatePath("/");
  revalidatePath("/vip");
  if (id) revalidatePath(`/vip/${id}`);
  revalidatePath(`${adminPath("/index-messages")}`);
  revalidatePath(`${adminPath("/storage")}`);
}

export async function updateIndexMessageAction(id: string, formData: FormData) {
  await requireAdmin();
  const data = readIndexForm(formData);
  if (!validateIndex(data)) redirect(`${adminPath("/index-messages")}?edit=${id}&error=missing`);

  await prisma.tgIndexedMessage.update({
    where: { id },
    data: {
      title: data.title,
      snippet: data.snippet,
      rawText: data.rawText || data.snippet,
      contentType: data.contentType,
      mediaUrl: data.mediaUrl,
      galleryImageUrls: data.galleryImageUrls,
      galleryVideoUrls: data.galleryVideoUrls,
      contentBlocks: data.contentBlocks,
      sourceTitle: data.sourceTitle,
      sourceUsername: data.sourceUsername,
      durationSec: data.durationSec,
      isPinned: data.isPinned,
      heat: data.heat,
      views: data.views
    }
  });

  revalidateIndexPaths(id);
  redirect(`${adminPath("/index-messages")}?saved=1`);
}

export async function deleteIndexMessageAction(id: string) {
  await requireAdmin();
  const result = await deleteIndexMessagesWithMedia([id]);
  revalidateIndexPaths(id);
  redirect(
    `${adminPath("/index-messages")}?deleted=1&media=${result.mediaDeleted}&mediaFailed=${result.mediaFailed}`
  );
}

export async function batchDeleteIndexMessagesAction(formData: FormData) {
  await requireAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) {
    redirect(`${adminPath("/index-messages")}?error=empty`);
  }

  const result = await deleteIndexMessagesWithMedia(ids);
  revalidateIndexPaths();
  redirect(
    `${adminPath("/index-messages")}?deleted=${result.deleted}&media=${result.mediaDeleted}&mediaFailed=${result.mediaFailed}`
  );
}
