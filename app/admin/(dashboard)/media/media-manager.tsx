"use client";

import { useAdminPath } from "@/lib/admin-path-context";
import { useRouter } from "next/navigation";
import type { MediaAsset } from "@/lib/generated/prisma";

export default function MediaManager({ media, maxUploadMb }: { media: MediaAsset[]; maxUploadMb: number }) {
  const router = useRouter();
  const { apiPath } = useAdminPath();
  const maxBytes = maxUploadMb * 1024 * 1024;

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const f = form.get("file");
    if (f instanceof File && f.size > maxBytes) {
      alert(`文件约 ${(f.size / (1024 * 1024)).toFixed(1)} MB，超过当前上限 ${maxUploadMb} MB。\n可在服务器设置环境变量 ADMIN_UPLOAD_MAX_MB，并同步调大 Nginx 的 client_max_body_size。`);
      return;
    }
    const res = await fetch(apiPath("media"), { method: "POST", body: form });
    if (!res.ok) {
      let msg = `上传失败（HTTP ${res.status}）`;
      try {
        const j = (await res.json()) as { error?: string; maxMb?: number; sizeMb?: number };
        if (j.error) msg = j.error;
        if (res.status === 413 && j.maxMb != null) {
          msg += `\n当前单文件上限：${j.maxMb} MB` + (j.sizeMb != null ? `，本文件约 ${j.sizeMb} MB` : "");
          msg += "\n若未走到本提示、浏览器只显示 too large，多半是前置 Nginx 的 client_max_body_size 过小。";
        }
      } catch {
        if (res.status === 413) {
          msg +=
            "\n常见原因：Nginx client_max_body_size（默认 1m）小于视频体积；请调大后 reload Nginx，并与 ADMIN_UPLOAD_MAX_MB 一致。";
        }
      }
      alert(msg);
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <>
      <form className="form-card admin-panel toolbar" style={{ padding: 18, marginBottom: 18 }} onSubmit={upload}>
        <input name="file" type="file" accept="image/*,video/*" required />
        <button className="btn btn-admin-primary" type="submit">
          上传媒体
        </button>
        <span style={{ marginLeft: 12, fontSize: 13, color: "var(--muted)" }}>
          单文件上限约 {maxUploadMb} MB（环境变量 ADMIN_UPLOAD_MAX_MB）；前置 Nginx 需同步调大 client_max_body_size。
        </span>
      </form>
      <div className="media-grid">
        {media.map((item) => (
          <div className="admin-card" key={item.id}>
            {item.type === "VIDEO" ? <video src={item.url} controls /> : <img src={item.url} alt={item.filename} />}
            <strong style={{ fontSize: 15 }}>{item.filename}</strong>
            <p style={{ color: "var(--muted)", wordBreak: "break-all" }}>{item.url}</p>
          </div>
        ))}
      </div>
    </>
  );
}
