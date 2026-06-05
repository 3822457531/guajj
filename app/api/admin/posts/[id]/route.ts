import { NextResponse } from "next/server";
import { PostStatus, PostType } from "@/lib/generated/prisma";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function parsePayload(request: Request) {
  const body = await request.json();
  const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds.map(String) : [];
  return {
    title: String(body.title || "").trim(),
    summary: String(body.summary || "").trim(),
    body: String(body.body || "").trim(),
    type: Object.values(PostType).includes(body.type) ? body.type : PostType.ARTICLE,
    status: Object.values(PostStatus).includes(body.status) ? body.status : PostStatus.DRAFT,
    coverUrl: String(body.coverUrl || "").trim(),
    videoUrl: String(body.videoUrl || "").trim() || null,
    galleryImageUrls: String(body.galleryImageUrls || "").trim() || null,
    galleryVideoUrls: String(body.galleryVideoUrls || "").trim() || null,
    contentBlocks: String(body.contentBlocks || "").trim() || null,
    isPinned: Boolean(body.isPinned),
    views: Math.max(0, Math.floor(Number(body.views ?? body.heat ?? 0))),
    categoryId: String(body.categoryId || ""),
    tagIds
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await parsePayload(request);

  if (!data.title || !data.summary || !data.body || !data.coverUrl || !data.categoryId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await prisma.postTag.deleteMany({ where: { postId: id } });
  const post = await prisma.post.update({
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

  return NextResponse.json(post);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
