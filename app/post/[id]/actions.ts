"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPublishedPostComment } from "@/lib/public-comment";

/**
 * 与后台 `post-form.tsx` 一致：`<form action={submitCommentAction}>` + FormData，
 * 不依赖客户端 onClick / fetch，避免水合或网络环境下「点了没反应」。
 *
 * `parentIdBound` 由客户端 `.bind(null, replyTarget?.id ?? "")` 传入。
 * 仅用隐藏域 `defaultValue` 时，在部分环境下提交 FormData 可能拿不到最新父评论 ID，导致回复变成顶层评论。
 */
export async function submitCommentAction(parentIdBound: string, formData: FormData) {
  const postId = String(formData.get("postId") || "").trim();
  if (!postId) redirect("/");

  const parentRaw = formData.get("parentId");
  const fromForm =
    typeof parentRaw === "string" && parentRaw.trim().length > 0 ? parentRaw.trim() : null;
  const fromBind =
    typeof parentIdBound === "string" && parentIdBound.trim().length > 0 ? parentIdBound.trim() : null;
  const parentId = fromBind ?? fromForm;

  const bodyRaw = String(formData.get("body") || "");

  const result = await createPublishedPostComment(postId, bodyRaw, parentId);
  if (!result.ok) {
    redirect(`/post/${postId}?cerr=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/post/${postId}`);
  redirect(`/post/${postId}?cok=1`);
}
