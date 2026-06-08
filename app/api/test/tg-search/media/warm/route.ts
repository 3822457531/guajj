import { handleTgMediaWarmPost } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleTgMediaWarmPost(request);
}
