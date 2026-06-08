import { handleTgMediaStreamGet } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleTgMediaStreamGet(request);
}
