import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { buildCommentTree } from "@/lib/comments-tree";
import { PostStatus } from "@/lib/generated/prisma";
import { createPublishedPostComment } from "@/lib/public-comment";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const postId = (await params).id;
  const post = await prisma.post.findFirst({ where: { id: postId, status: PostStatus.PUBLISHED } });
  if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

  const rows = await prisma.comment.findMany({
    where: { postId },
    include: { author: true },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({ tree: buildCommentTree(rows) });
}

export async function POST(request: Request, { params }: RouteContext) {
  const postId = (await params).id;

  let payload: { body?: unknown; parentId?: unknown };
  try {
    payload = (await request.json()) as { body?: unknown; parentId?: unknown };
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const parentId = typeof payload.parentId === "string" && payload.parentId ? payload.parentId : null;
  const result = await createPublishedPostComment(postId, String(payload.body ?? ""), parentId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath(`/post/${postId}`);
  return NextResponse.json({ ok: true, comment: result.comment });
}
