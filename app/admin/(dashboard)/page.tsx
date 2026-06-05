import { prisma } from "@/lib/prisma";
import { getAnalyticsOverview } from "@/lib/analytics";
import { getGuestUserStatsOverview } from "@/lib/guest-user";

export default async function AdminHomePage() {
  const [posts, published, media, categories, socialUsers, analytics, guestStats] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.mediaAsset.count(),
    prisma.category.count(),
    prisma.socialUser.count(),
    getAnalyticsOverview(),
    getGuestUserStatsOverview()
  ]);

  return (
    <>
      <div className="admin-grid">
        <div className="admin-card admin-stat-card">全部内容<strong>{posts}</strong></div>
        <div className="admin-card admin-stat-card">已发布<strong>{published}</strong></div>
        <div className="admin-card admin-stat-card">媒体资源<strong>{media}</strong></div>
        <div className="admin-card admin-stat-card">分类数量<strong>{categories}</strong></div>
        <div className="admin-card admin-stat-card">登录用户<strong>{socialUsers}</strong></div>
        <div className="admin-card admin-stat-card">匿名用户<strong>{guestStats.total}</strong></div>
        <div className="admin-card admin-stat-card">今日新增用户<strong>{guestStats.todayNew}</strong></div>
        <div className="admin-card admin-stat-card">今日 PV<strong>{analytics.today.pageViews}</strong></div>
        <div className="admin-card admin-stat-card">今日 UV<strong>{analytics.today.uniqueVisitors}</strong></div>
        <div className="admin-card admin-stat-card">今日登录访问<strong>{analytics.today.loggedInPageViews}</strong></div>
      </div>
    </>
  );
}
