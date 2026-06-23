import type { ReactNode } from "react";

/** 从短信正文提取验证码（4–8 位数字） */
export function extractSmsVerificationCode(text: string): string | null {
  const patterns = [/验证码[^\d]{0,10}(\d{4,8})/, /【[^】]+】[^\d]*(\d{4,8})/, /\b(\d{4,8})\b/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

const DIGIT_RUN = /\d+/g;

/** 完整短信展示：数字高亮，验证码段额外强调 */
export function highlightSmsMessage(text: string, code?: string | null): ReactNode[] {
  const emphasis = code?.trim() || extractSmsVerificationCode(text);
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(DIGIT_RUN)) {
    const value = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const isCode = Boolean(emphasis && value === emphasis);
    nodes.push(
      <mark
        key={`digit-${matchIndex}`}
        className={isCode ? "sms-msg-code-mark sms-msg-code-mark--primary" : "sms-msg-code-mark"}
      >
        {value}
      </mark>
    );
    matchIndex += 1;
    lastIndex = start + value.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : [text];
}

export function formatSmsHistoryTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
