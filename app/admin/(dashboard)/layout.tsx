import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminHeader from "./admin-header";
import AdminSidebar from "./admin-sidebar";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { username: true }
  });
  const displayName = user?.username ?? "管理员";

  return (
    <div className="admin-layout">
      <AdminSidebar username={displayName} />
      <div className="admin-main-column">
        <AdminHeader username={displayName} />
        <div className="admin-main">{children}</div>
      </div>
    </div>
  );
}
