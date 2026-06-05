"use server";

import { adminPath } from "@/lib/admin-path";
import { Prisma } from "@/lib/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function slugify(input: string, fallbackPrefix: "cat" | "tag") {
  const t = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return t || `${fallbackPrefix}-${Date.now()}`;
}

function taxonomyPaths() {
  revalidatePath(`${adminPath("/taxonomy")}`);
  revalidatePath(`${adminPath("/posts")}`);
  revalidatePath(`${adminPath("/telegram")}`);
  revalidatePath("/");
}

function handleUnique(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    redirect(`${adminPath("/taxonomy")}?error=duplicate`);
  }
  throw e;
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect(`${adminPath("/taxonomy")}?error=name`);
  const slugRaw = String(formData.get("slug") || "").trim();
  const slug = slugify(slugRaw || name, "cat");
  try {
    await prisma.category.create({ data: { name, slug } });
  } catch (e) {
    handleUnique(e);
  }
  taxonomyPaths();
  redirect(`${adminPath("/taxonomy")}?saved=category`);
}

export async function updateCategoryAction(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect(`${adminPath("/taxonomy")}?error=name`);
  const slugRaw = String(formData.get("slug") || "").trim();
  const slug = slugify(slugRaw || name, "cat");
  try {
    await prisma.category.update({ where: { id }, data: { name, slug } });
  } catch (e) {
    handleUnique(e);
  }
  taxonomyPaths();
  redirect(`${adminPath("/taxonomy")}?saved=category`);
}

export async function deleteCategoryAction(id: string) {
  await requireAdmin();
  const count = await prisma.post.count({ where: { categoryId: id } });
  if (count > 0) redirect(`${adminPath("/taxonomy")}?error=category-in-use`);
  await prisma.category.delete({ where: { id } });
  taxonomyPaths();
  redirect(`${adminPath("/taxonomy")}?saved=category`);
}

export async function createTagAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect(`${adminPath("/taxonomy")}?error=name`);
  const slugRaw = String(formData.get("slug") || "").trim();
  const slug = slugify(slugRaw || name, "tag");
  try {
    await prisma.tag.create({ data: { name, slug } });
  } catch (e) {
    handleUnique(e);
  }
  taxonomyPaths();
  redirect(`${adminPath("/taxonomy")}?saved=tag`);
}

export async function updateTagAction(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect(`${adminPath("/taxonomy")}?error=name`);
  const slugRaw = String(formData.get("slug") || "").trim();
  const slug = slugify(slugRaw || name, "tag");
  try {
    await prisma.tag.update({ where: { id }, data: { name, slug } });
  } catch (e) {
    handleUnique(e);
  }
  taxonomyPaths();
  redirect(`${adminPath("/taxonomy")}?saved=tag`);
}

export async function deleteTagAction(id: string) {
  await requireAdmin();
  await prisma.tag.delete({ where: { id } });
  taxonomyPaths();
  redirect(`${adminPath("/taxonomy")}?saved=tag`);
}
