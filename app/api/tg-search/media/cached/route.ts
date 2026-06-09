import { handleTgMediaCachedGet } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleTgMediaCachedGet(request);
}
