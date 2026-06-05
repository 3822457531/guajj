import { changeAdminPasswordAction } from "./password-actions";

const pwdMessages: Record<string, string> = {
  ok: "密码已更新。",
  wrong: "当前密码不正确。",
  mismatch: "两次输入的新密码不一致。",
  short: "新密码至少 8 位。",
  missing: "请填写所有密码字段。"
};

export default function AccountPasswordForm({ pwdStatus }: { pwdStatus?: string }) {
  const flash = pwdStatus ? pwdMessages[pwdStatus] : null;
  const isError = pwdStatus && pwdStatus !== "ok";

  return (
    <div className="form-card admin-panel" style={{ padding: 22, maxWidth: 640, marginTop: 24 }}>
      <h2 style={{ margin: "0 0 8px" }}>账户安全</h2>
      <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
        修改当前登录管理员账号的密码。用户名仍为登录时填写的账号（默认 admin），与后台访问路径无关。
      </p>
      {flash ? (
        <p className={`admin-flash${isError ? "" : " success"}`} style={isError ? { color: "var(--brand)" } : undefined}>
          {flash}
        </p>
      ) : null}
      <form action={changeAdminPasswordAction} className="form-grid">
        <div className="field">
          <label htmlFor="current-password">当前密码</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">新密码</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">确认新密码</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button type="submit" className="btn btn-admin-primary">
          更新密码
        </button>
      </form>
    </div>
  );
}
