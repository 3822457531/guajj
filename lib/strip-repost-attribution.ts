/**
 * 去掉稿件中的「转自 xxx」类来源标注（TG forwardPrefix、手动粘贴等），
 * 用于前台展示与 TG 入库正文，避免与摘要重复且利于版权展示口径。
 */

/** 整行仅为转自类标注 */
export function isRepostAttributionOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^【\s*转自[^】]*】$/.test(t)) return true;
  if (/^（\s*转自[^）]*）$/.test(t)) return true;
  if (/^\[\s*转自[^\]]*\]$/.test(t)) return true;
  if (/^\(\s*转自[^)]*\)$/.test(t)) return true;
  return false;
}

/** 去掉独立成行的标注 + 正文中任意位置的同名片段（仅匹配含「转自」的固定括号形态） */
export function stripRepostAttributionFromText(text: string): string {
  if (!text?.trim()) return "";
  let s = text.replace(/\r\n/g, "\n");
  const lines = s.split("\n");
  s = lines.filter((line) => !isRepostAttributionOnlyLine(line)).join("\n");

  s = s.replace(/【\s*转自[^】]*】/g, "");
  s = s.replace(/（\s*转自[^）]*）/g, "");
  s = s.replace(/\[\s*转自[^\]]*\]/g, "");
  s = s.replace(/\(\s*转自[^)]*\)/g, "");

  return s
    .replace(/[ \t\f\v]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
