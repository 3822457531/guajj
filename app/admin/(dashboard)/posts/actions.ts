"use server";

import { adminPath } from "@/lib/admin-path";
import { PostStatus, PostType } from "@/lib/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function readPostForm(formData: FormData) {
  const type = String(formData.get("type") || "ARTICLE");
  const status = String(formData.get("status") || "DRAFT");

  const galleryRaw = String(formData.get("galleryImageUrls") || "").trim();
  const galleryVideosRaw = String(formData.get("galleryVideoUrls") || "").trim();
  const contentBlocksRaw = String(formData.get("contentBlocks") || "").trim();

  return {
    title: String(formData.get("title") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    body: String(formData.get("body") || "").trim(),
    type: Object.values(PostType).includes(type as PostType) ? (type as PostType) : PostType.ARTICLE,
    status: Object.values(PostStatus).includes(status as PostStatus) ? (status as PostStatus) : PostStatus.DRAFT,
    coverUrl: String(formData.get("coverUrl") || "").trim(),
    videoUrl: String(formData.get("videoUrl") || "").trim() || null,
    galleryImageUrls: galleryRaw || null,
    galleryVideoUrls: galleryVideosRaw || null,
    contentBlocks: contentBlocksRaw || null,
    isPinned: formData.get("isPinned") === "on",
    views: Math.max(0, Math.floor(Number(formData.get("views") ?? 0))),
    categoryId: String(formData.get("categoryId") || ""),
    tagIds: formData.getAll("tagIds").map(String)
  };
}

function validatePost(data: ReturnType<typeof readPostForm>) {
  return data.title && data.summary && data.body && data.coverUrl && data.categoryId;
}

export async function createPostAction(formData: FormData) {
  await requireAdmin();
  const data = readPostForm(formData);
  if (!validatePost(data)) redirect(`${adminPath("/posts")}?error=missing`);

  await prisma.post.create({
    data: {
      title: data.title,
      summary: data.summary,
      body: data.body,
      type: data.type,
      status: data.status,
      coverUrl: data.coverUrl,
      videoUrl: data.videoUrl,
      galleryImageUrls: data.galleryImageUrls,
      galleryVideoUrls: data.galleryVideoUrls,
      contentBlocks: data.contentBlocks,
      isPinned: data.isPinned,
      views: data.views,
      heat: data.views,
      categoryId: data.categoryId,
      publishedAt: data.status === PostStatus.PUBLISHED ? new Date() : null,
      tags: { create: data.tagIds.map((tagId) => ({ tagId })) }
    }
  });

  revalidatePath("/");
  revalidatePath(`${adminPath("/posts")}`);
  redirect(`${adminPath("/posts")}?saved=1`);
}

export async function updatePostAction(id: string, formData: FormData) {
  await requireAdmin();
  const data = readPostForm(formData);
  if (!validatePost(data)) redirect(`${adminPath("/posts")}?edit=${id}&error=missing`);

  await prisma.postTag.deleteMany({ where: { postId: id } });
  await prisma.post.update({
    where: { id },
    data: {
      title: data.title,
      summary: data.summary,
      body: data.body,
      type: data.type,
      status: data.status,
      coverUrl: data.coverUrl,
      videoUrl: data.videoUrl,
      galleryImageUrls: data.galleryImageUrls,
      galleryVideoUrls: data.galleryVideoUrls,
      contentBlocks: data.contentBlocks,
      isPinned: data.isPinned,
      views: data.views,
      heat: data.views,
      categoryId: data.categoryId,
      publishedAt: data.status === PostStatus.PUBLISHED ? new Date() : null,
      tags: { create: data.tagIds.map((tagId) => ({ tagId })) }
    }
  });

  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath(`${adminPath("/posts")}`);
  redirect(`${adminPath("/posts")}?saved=1`);
}

export async function deletePostAction(id: string) {
  await requireAdmin();
  await prisma.post.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath(`${adminPath("/posts")}`);
  redirect(`${adminPath("/posts")}?deleted=1`);
}
