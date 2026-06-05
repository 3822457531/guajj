import { NextResponse } from "next/server";
import { PostStatus } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

/** 同类推荐换一批：同分类随机 4 条（不含当前） */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await prisma.post.findFirst({
    where: { id, status: PostStatus.PUBLISHED },
    select: { categoryId: true }
  });
  if (!current) return NextResponse.json({ items: [] });

  const pool = await prisma.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      id: { not: id },
      categoryId: current.categoryId
    },
    take: 32,
    orderBy: { views: "desc" },
    select: {
      id: true,
      title: true,
      category: { select: { name: true } }
    }
  });

  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  return NextResponse.json({ items: shuffled });
}
