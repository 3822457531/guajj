import { getAdminPathPrefix } from "@/lib/admin-path";
import { AdminPathProvider } from "@/lib/admin-path-context";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const prefix = getAdminPathPrefix();

  return <AdminPathProvider prefix={prefix}>{children}</AdminPathProvider>;
}
