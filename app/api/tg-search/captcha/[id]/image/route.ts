import { handleTgCaptchaImageGet } from "@/lib/tg-search-api-handlers";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return handleTgCaptchaImageGet(String(id ?? "").trim());
}
