import { listEnabledGuapiPackages } from "@/lib/guapi-pay";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listEnabledGuapiPackages();
    return Response.json({ ok: true, ...data });
  } catch (err) {
    console.error("[pay/packages]", err);
    return Response.json({ ok: false, message: "加载套餐失败" }, { status: 500 });
  }
}
