import { handleTgCaptchaSolvePost, TG_SEARCH_API } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  return handleTgCaptchaSolvePost(request, TG_SEARCH_API.prod);
}
