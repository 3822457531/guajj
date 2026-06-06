import { handleTgChannelGet } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleTgChannelGet(request);
}
