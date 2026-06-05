import { prisma } from "@/lib/prisma";
import { getSocialUserVisitCounts } from "@/lib/analytics";
import SocialUsersTable from "./social-users-table";

export default async function AdminSocialUsersPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const params = await searchParams;
  const rows = await prisma.socialUser.findMany({
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      _count: { select: { comments: true } }
    }
  });

  const visitCounts = await getSocialUserVisitCounts(rows.map((row) => row.id));

  return (
    <>
      {params.deleted ? <p className="admin-flash success">用户已删除，其评论已一并移除。</p> : null}
      <p className="admin-page-note" style={{ marginTop: 0 }}>
        前台通过 QQ / 微信等聚合登录的用户，用于评论身份展示。「上次登录」在每次 OAuth 回调成功时更新；「近 7 天访问」来自访问统计。
      </p>
      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>暂无登录用户。</p>
      ) : (
        <div className="admin-panel" style={{ padding: 0, overflow: "hidden" }}>
          <SocialUsersTable rows={rows} visitCounts={visitCounts} />
        </div>
      )}
    </>
  );
}
