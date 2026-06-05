import TaxonomyManager from "./taxonomy-manager";
import { prisma } from "@/lib/prisma";

export default async function TaxonomyPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <TaxonomyManager
      categories={categories}
      tags={tags}
      flashSaved={params.saved ?? null}
      flashError={params.error ?? null}
    />
  );
}
