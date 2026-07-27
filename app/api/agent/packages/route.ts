import { listEnabledAgentPackages } from "@/lib/agent-pay";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listEnabledAgentPackages();
    return Response.json({ ok: true, ...data });
  } catch (err) {
    console.error("[agent/packages]", err);
    return Response.json({ ok: false, message: "加载套餐失败" }, { status: 500 });
  }
}
