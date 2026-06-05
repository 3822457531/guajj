import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { getAdminSession } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAdminSession();
  if (session) redirect(adminPath());
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-box">
        <h1>吃瓜网后台</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}></p>
        <LoginForm hasError={params.error === "1"} />
      </section>
    </main>
  );
}
