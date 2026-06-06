import { handleTgSearchPost, TG_SEARCH_API } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleTgSearchPost(request, TG_SEARCH_API.prod);
}
