import { NextResponse } from "next/server";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import { getGuestViewHistory, hideGuestViewHistory } from "@/lib/view-guapi";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getGuestSessionPayload();
  if (!session?.guestUserId) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const items = await getGuestViewHistory(session.guestUserId, 30);
  return NextResponse.json({
    ok: true,
    items: items.map((row) => ({
      id: row.id,
      username: row.username,
      messageId: row.messageId,
      title: row.title,
      label: row.label,
      searchQuery: row.searchQuery,
      viewedAt: row.updatedAt.toISOString()
    }))
  });
}

export async function DELETE(request: Request) {
  const session = await getGuestSessionPayload();
  if (!session?.guestUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { all?: boolean; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (body.all) {
    await hideGuestViewHistory(session.guestUserId, { all: true });
    return NextResponse.json({ ok: true });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  await hideGuestViewHistory(session.guestUserId, { id });
  return NextResponse.json({ ok: true });
}
