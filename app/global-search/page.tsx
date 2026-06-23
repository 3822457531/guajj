import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "全网搜索 · 吃瓜网",
  description: "暗网索引 · 检索全网视频、图片与文字资源"
};

export default async function GlobalSearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  redirect(q ? `/vip?tab=search&q=${encodeURIComponent(q)}` : "/vip?tab=search");
}
