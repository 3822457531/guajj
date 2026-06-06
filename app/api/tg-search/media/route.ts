import { handleTgMediaGet } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  return handleTgMediaGet(request);
}
