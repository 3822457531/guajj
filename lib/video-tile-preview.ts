/** 列表格内 `<video>` 用：无海报时靠 `#t=` 触发解码首帧（站内相对路径常见可用；外链不追加以免签名失效） */
export function videoSrcForListThumbnail(src: string): string {
  const t = src.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  const base = t.split("#")[0] ?? t;
  return `${base}#t=0.08`;
}

export function videoSrcForPlayback(src: string): string {
  return src.trim().split("#")[0] ?? src;
}
