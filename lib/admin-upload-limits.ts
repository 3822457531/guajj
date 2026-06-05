const MIB = 1024 * 1024;

const DEFAULT_MAX_MB = 512;

/**
 * 管理后台「上传媒体」单文件大小上限（MB），对应 `/api/admin/media`。
 * 环境变量 `ADMIN_UPLOAD_MAX_MB`（正数）；未设置时默认 512。
 * 若前置 Nginx 等仍返回 413，需同步调大 `client_max_body_size`。
 */
export function getAdminUploadMaxMb(): number {
  const raw = process.env.ADMIN_UPLOAD_MAX_MB;
  const mb = raw === undefined || raw === "" ? DEFAULT_MAX_MB : Number(raw);
  if (!Number.isFinite(mb) || mb <= 0) return DEFAULT_MAX_MB;
  return mb;
}

export function getAdminUploadMaxBytes(): number {
  return Math.floor(getAdminUploadMaxMb() * MIB);
}
