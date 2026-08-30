import { handleTgViewBillPost } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleTgViewBillPost(request);
}
