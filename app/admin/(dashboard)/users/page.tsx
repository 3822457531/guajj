import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import GuestUsersTable, { type AdminGuestUserRow } from "./guest-users-table";

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export default async function AdminGuestUsersPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSiteSettings();
  const todayStart = startOfDayUtc(new Date());

  const rows = await prisma.guestUser.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      referrer: { select: { publicId: true } },
      _count: { select: { referrals: true, searchLogs: true } }
    }
  });

  const todayGrouped =
    rows.length > 0
      ? await prisma.searchLog.groupBy({
          by: ["guestUserId"],
          where: {
            guestUserId: { in: rows.map((row) => row.id) },
            createdAt: { gte: todayStart }
          },
          _count: { guestUserId: true }
        })
      : [];

  const todayMap = new Map(
    todayGrouped
      .filter((item) => item.guestUserId)
      .map((item) => [item.guestUserId!, item._count.guestUserId])
  );

  const tableRows: AdminGuestUserRow[] = rows.map((row) => ({
    ...row,
    todaySearchCount: todayMap.get(row.id) ?? 0
  }));

  return (
    <>
      {params.deleted ? <p className="admin-flash success">用户已删除。</p> : null}
      <p className="admin-page-note" style={{ marginTop: 0 }}>
        前台通过「匿名加密身份」自动注册的用户（GUA 编号）。密钥仅以哈希存储于服务端，不在后台展示。当前全站每日基础搜索{" "}
        <strong>{settings.dailySearchLimit}</strong> 次，每成功邀请额外{" "}
        <strong>{settings.referralSearchBonus}</strong> 次。
      </p>
      {tableRows.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>暂无匿名注册用户。</p>
      ) : (
        <div className="admin-panel" style={{ padding: 0, overflow: "hidden" }}>
          <GuestUsersTable rows={tableRows} />
        </div>
      )}
    </>
  );
}
