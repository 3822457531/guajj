import { adminLogoutAction } from "./logout-action";

export default function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={adminLogoutAction}>
      <button type="submit" className={className ?? "admin-sidebar-logout"}>
        退出登录
      </button>
    </form>
  );
}
