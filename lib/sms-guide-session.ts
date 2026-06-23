export type SmsGuideStep = 1 | 2 | 3;

export type SmsGuideSession = {
  guideStep: SmsGuideStep;
  currentPhone: string;
  phoneInput: string;
  keyword: string;
  smsResult: string;
};

const STORAGE_KEY = "h5-sms-guide-session";

function normalizeStep(step: number, phone: string): SmsGuideStep {
  if (!phone) return 1;
  if (step === 2 || step === 3) return step;
  return 2;
}

export function readSmsGuideSession(): SmsGuideSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SmsGuideSession>;
    const currentPhone = typeof parsed.currentPhone === "string" ? parsed.currentPhone : "";
    const guideStep = normalizeStep(Number(parsed.guideStep), currentPhone);
    return {
      guideStep,
      currentPhone,
      phoneInput: typeof parsed.phoneInput === "string" ? parsed.phoneInput : "",
      keyword: typeof parsed.keyword === "string" && parsed.keyword.trim() ? parsed.keyword : "验证码",
      smsResult: typeof parsed.smsResult === "string" ? parsed.smsResult : ""
    };
  } catch {
    return null;
  }
}

export function writeSmsGuideSession(session: SmsGuideSession) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSmsGuideSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
