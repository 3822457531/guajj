"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractSmsVerificationCode,
  formatSmsHistoryTime,
  highlightSmsMessage
} from "@/lib/sms-message-display";
import {
  clearSmsGuideSession,
  readSmsGuideSession,
  writeSmsGuideSession,
  type SmsGuideStep
} from "@/lib/sms-guide-session";

type SmsPricing = { get_number: number; get_sms: number; send_sms: number };
type HistoryItem = { time: string; phone: string | null; message: string | null };
type SmsNumberMode = "random" | "real";

const HISTORY_PAGE_SIZE = 15;
const DEFAULT_SMS_KEYWORD = "验证码";

const GUIDE_STEPS: { id: SmsGuideStep; label: string }[] = [
  { id: 1, label: "取号" },
  { id: 2, label: "填号" },
  { id: 3, label: "收码" }
];

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

function SmsPhoneHero({
  phone,
  copied,
  onCopy
}: {
  phone: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const hasPhone = Boolean(phone.trim());

  return (
    <section className="sms-phone-hero" aria-label="当前暗网手机号">
      <div className="sms-phone-hero-glow" aria-hidden />
      <p className="sms-phone-hero-label">你的临时号码</p>
      <div className="sms-phone-hero-row">
        {hasPhone ? (
          <>
            <button type="button" className="sms-phone-number" onClick={onCopy} title="点击复制">
              {formatPhoneDisplay(phone)}
            </button>
            <button type="button" className="sms-copy-btn" onClick={onCopy}>
              {copied ? "已复制" : "复制"}
            </button>
          </>
        ) : (
          <p className="sms-phone-number sms-phone-number--pending">获取号码后显示</p>
        )}
      </div>
      <p className="sms-phone-hero-hint">
        {hasPhone ? "点击号码或「复制」，粘贴到如百度等 / App / 网站注册页" : "在下方完成取号，号码将显示在此处"}
      </p>
    </section>
  );
}

function initialSmsGuideState() {
  const saved = readSmsGuideSession();
  if (!saved) {
    return {
      guideStep: 1 as SmsGuideStep,
      currentPhone: "",
      phoneInput: "",
      keyword: DEFAULT_SMS_KEYWORD,
      smsResult: ""
    };
  }
  return {
    ...saved,
    keyword: saved.keyword.trim() || DEFAULT_SMS_KEYWORD
  };
}

export function SmsClient({ guestReady }: { guestReady: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  const [guideStep, setGuideStep] = useState<SmsGuideStep>(1);
  const [pricing, setPricing] = useState<SmsPricing | null>(null);

  const [phoneInput, setPhoneInput] = useState("");
  const [numberMode, setNumberMode] = useState<SmsNumberMode>("random");
  const [currentPhone, setCurrentPhone] = useState("");
  const [loadingNum, setLoadingNum] = useState(false);
  const [numErr, setNumErr] = useState("");

  const [keyword, setKeyword] = useState(DEFAULT_SMS_KEYWORD);
  const [smsResult, setSmsResult] = useState("");
  const [smsErr, setSmsErr] = useState("");
  const [loadingSms, setLoadingSms] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficient, setInsufficient] = useState({ balance: 0, required: 0 });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const pricingBootstrapped = useRef(false);
  const historyBootstrapped = useRef(false);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    setHistoryLoaded(true);
    try {
      const res = await fetch(`/api/sms/history?page=${page}&size=${HISTORY_PAGE_SIZE}`, { cache: "no-store" });
      const data = await readJson<{ code?: number; list?: HistoryItem[]; msg?: HistoryItem[] }>(res);
      if (data.code === 0) {
        const list = Array.isArray(data.list) ? data.list : Array.isArray(data.msg) ? data.msg : [];
        setHistory(list);
        setHistoryPage(page);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = initialSmsGuideState();
    setGuideStep(saved.guideStep);
    setCurrentPhone(saved.currentPhone);
    setPhoneInput(saved.phoneInput);
    setKeyword(saved.keyword);
    setSmsResult(saved.smsResult);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !guestReady) return;
    writeSmsGuideSession({ guideStep, currentPhone, phoneInput, keyword, smsResult });
  }, [hydrated, guestReady, guideStep, currentPhone, phoneInput, keyword, smsResult]);

  useEffect(() => {
    if (!hydrated || !guestReady || historyBootstrapped.current) return;
    historyBootstrapped.current = true;
    void loadHistory(1);
  }, [hydrated, guestReady, loadHistory]);

  const copyText = useCallback(async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const showInsufficient = (balanceVal: number, requiredVal: number) => {
    setInsufficient({ balance: balanceVal, required: requiredVal });
    setInsufficientOpen(true);
  };

  async function requestNumber() {
    setNumErr("");
    setLoadingNum(true);
    try {
      const params = new URLSearchParams();
      if (phoneInput.trim()) params.set("phone", phoneInput.trim());
      if (!phoneInput.trim() && numberMode === "real") params.set("real", "1");
      const res = await fetch(`/api/sms/number?${params.toString()}`, { cache: "no-store" });
      const data = await readJson<{ code?: number; msg?: string; phone?: string; data?: { balance?: number; required?: number; code?: string } }>(res);
      if (res.status === 402 && data.data?.code === "INSUFFICIENT_GUAPI") {
        showInsufficient(data.data.balance ?? 0, data.data.required ?? 0);
        setNumErr(data.msg || "瓜皮不足");
        return;
      }
      if (data.code === 0 && data.phone) {
        setCurrentPhone(data.phone);
        setSmsResult("");
        setSmsErr("");
        setKeyword(DEFAULT_SMS_KEYWORD);
        setGuideStep(2);
      } else {
        setNumErr(data.msg || "请求失败");
      }
    } catch (e) {
      setNumErr(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoadingNum(false);
    }
  }

  async function fetchSms() {
    if (!currentPhone) {
      setSmsErr("请先获取号码");
      return;
    }
    if (!keyword.trim()) {
      setSmsErr("请输入关键词，如平台名称");
      return;
    }
    setSmsErr("");
    setSmsResult("");
    setLoadingSms(true);
    try {
      const params = new URLSearchParams({ phone: currentPhone, keyword: keyword.trim() });
      const res = await fetch(`/api/sms/sms?${params.toString()}`, { cache: "no-store" });
      const data = await readJson<{ code?: number; msg?: string; data?: { balance?: number; required?: number; code?: string } }>(res);
      if (res.status === 402 && data.data?.code === "INSUFFICIENT_GUAPI") {
        showInsufficient(data.data.balance ?? 0, data.data.required ?? 0);
        setSmsErr(data.msg || "瓜皮不足");
        return;
      }
      if (data.code === 0) {
        const message = String(data.msg || "(无内容)");
        setSmsResult(message);
        void loadHistory(1);
      } else {
        setSmsErr(data.msg || "未收到短信，请稍后再试");
      }
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : "获取失败");
    } finally {
      setLoadingSms(false);
    }
  }

  useEffect(() => {
    if (!pricingBootstrapped.current) {
      pricingBootstrapped.current = true;
      void fetch("/api/sms/pricing", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { code?: number; data?: SmsPricing }) => {
          if (d.code === 0 && d.data) setPricing(d.data);
        })
        .catch(() => undefined);
    }
  }, []);

  const verificationCode = smsResult ? extractSmsVerificationCode(smsResult) : null;

  function restartFlow() {
    clearSmsGuideSession();
    setGuideStep(1);
    setCurrentPhone("");
    setPhoneInput("");
    setKeyword(DEFAULT_SMS_KEYWORD);
    setSmsResult("");
    setSmsErr("");
    setNumErr("");
  }

  if (!guestReady) {
    return (
      <div className="sms-empty-card">
        <span className="sms-empty-icon" aria-hidden>
          🔐
        </span>
        <p className="sms-empty-title">尚未创建身份</p>
        <p className="sms-empty-desc">暗网手机号需先完成年龄确认并生成本地加密身份。</p>
        <Link href="/my" className="sms-btn sms-btn--primary">
          前往我的身份
        </Link>
      </div>
    );
  }

  if (!hydrated) {
    return <div className="sms-layout sms-guide sms-guide--hydrating" aria-busy="true" />;
  }

  return (
    <div className="sms-layout sms-guide">
      <nav className="sms-guide-progress" aria-label="接码步骤">
        {GUIDE_STEPS.map((item, index) => (
          <div key={item.id} className={`sms-guide-progress-item${guideStep >= item.id ? " is-done" : ""}${guideStep === item.id ? " is-active" : ""}`}>
            <span className="sms-guide-progress-dot">{item.id}</span>
            <span className="sms-guide-progress-label">{item.label}</span>
            {index < GUIDE_STEPS.length - 1 ? <span className="sms-guide-progress-line" aria-hidden /> : null}
          </div>
        ))}
      </nav>

      {guideStep <= 3 ? (
        <SmsPhoneHero
          phone={currentPhone}
          copied={copiedField === "phone"}
          onCopy={() => void copyText("phone", currentPhone)}
        />
      ) : null}

      {guideStep === 1 ? (
        <section className="sms-flow-card sms-guide-panel">
          <div className="sms-step">
            <div className="sms-step-head">
              <span className="sms-step-badge">1</span>
              <div className="sms-step-head-text">
                <h2 className="sms-step-title">获取暗网手机号</h2>
              </div>
            </div>
            <div className="sms-tabs sms-number-mode-tabs" role="tablist" aria-label="取号模式">
              <button
                type="button"
                role="tab"
                aria-selected={numberMode === "random"}
                className={`sms-tab${numberMode === "random" ? " is-active" : ""}`}
                disabled={loadingNum}
                onClick={() => setNumberMode("random")}
              >
                随机号码
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={numberMode === "real"}
                className={`sms-tab${numberMode === "real" ? " is-active" : ""}`}
                disabled={loadingNum}
                onClick={() => setNumberMode("real")}
              >
                高质号码
              </button>
            </div>
            <p className="sms-hint">
              {phoneInput.trim()
                ? "将尝试获取指定号码"
                : numberMode === "real"
                  ? "随机分配真实号段（13 / 15 / 18 等）"
                  : "随机分配任意可用号码"}
            </p>
            <input
              className="sms-input"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="指定号码（可选）"
              inputMode="tel"
            />
            <button type="button" className="sms-btn sms-btn--primary sms-btn--block" disabled={loadingNum} onClick={() => void requestNumber()}>
              {loadingNum ? "获取中…" : "获取号码"}
            </button>
            {numErr ? <p className="sms-error">{numErr}</p> : null}
          </div>
        </section>
      ) : null}

      {guideStep === 2 ? (
        <section className="sms-guide-panel sms-guide-panel--copy">
          <div className="sms-step-head">
            <span className="sms-step-badge">2</span>
            <div className="sms-step-head-text">
              <h2 className="sms-step-title">复制号码到目标平台</h2>
            </div>
          </div>

          <ol className="sms-guide-tips">
            <li>打开目标平台注册或登录页</li>
            <li>将上方号码粘贴到「手机号」输入框</li>
            <li>在目标平台点击「获取验证码」</li>
          </ol>

          <button
            type="button"
            className="sms-btn sms-btn--primary sms-btn--block"
            onClick={() => {
              setKeyword((value) => value.trim() || DEFAULT_SMS_KEYWORD);
              setGuideStep(3);
            }}
          >
            我已在其它平台点击了获取验证码
          </button>
          <button type="button" className="sms-guide-back" onClick={() => {
            setCurrentPhone("");
            setGuideStep(1);
          }}>
            ← 重新取号
          </button>
        </section>
      ) : null}

      {guideStep === 3 ? (
        <section className="sms-flow-card sms-guide-panel">
          <div className="sms-step">
            <div className="sms-step-head">
              <span className="sms-step-badge">3</span>
              <div className="sms-step-head-text">
                <h2 className="sms-step-title">收取验证码</h2>
                {pricing ? <span className="sms-step-chip">-{pricing.get_sms} 瓜皮</span> : null}
              </div>
            </div>
            <p className="sms-hint">平台发码后，点击下方按钮拉取验证码（默认关键词「验证码」，可按需修改）。</p>
            <input
              className="sms-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="验证码"
            />
            <button type="button" className="sms-btn sms-btn--primary sms-btn--block" disabled={loadingSms} onClick={() => void fetchSms()}>
              {loadingSms ? "拉取中…" : "我已发送验证码，拉取短信"}
            </button>
            {smsResult ? (
              <div className="sms-code-box">
                <div className="sms-code-box-head">
                  <span>短信内容</span>
                  <button
                    type="button"
                    className="sms-copy-btn sms-copy-btn--ghost"
                    onClick={() => void copyText("sms", verificationCode || smsResult)}
                  >
                    {copiedField === "sms" ? "已复制" : verificationCode ? "复制验证码" : "复制全文"}
                  </button>
                </div>
                {verificationCode ? (
                  <p className="sms-code-digits" aria-label="验证码">
                    {verificationCode}
                  </p>
                ) : null}
                <p className="sms-msg-full">{highlightSmsMessage(smsResult, verificationCode)}</p>
              </div>
            ) : null}
            {smsErr ? <p className="sms-error">{smsErr}</p> : null}
            <div className="sms-guide-panel-actions">
              <button type="button" className="sms-guide-back" onClick={() => setGuideStep(2)}>
                ← 上一步
              </button>
              <button type="button" className="sms-guide-back" onClick={restartFlow}>
                重新取号
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="sms-records-card" aria-label="短信记录">
        <div className="sms-records-head">
          <h2 className="sms-records-title">短信记录</h2>
          <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={historyLoading} onClick={() => void loadHistory(historyPage)}>
            刷新
          </button>
        </div>
        {history.length ? (
          <ul className="sms-history-list">
            {history.map((item) => {
              const message = item.message?.trim() || "";
              const code = message ? extractSmsVerificationCode(message) : null;
              return (
                <li key={`${item.time}-${item.phone}-${message.slice(0, 24)}`} className="sms-history-item">
                  <div className="sms-history-meta">
                    <time>{formatSmsHistoryTime(item.time)}</time>
                    {item.phone ? <span className="sms-history-phone-static">{formatPhoneDisplay(item.phone)}</span> : null}
                  </div>
                  {message ? <p className="sms-history-msg">{highlightSmsMessage(message, code)}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : historyLoaded && !historyLoading ? (
          <p className="sms-muted">暂无短信记录</p>
        ) : null}
        {historyLoading ? <p className="sms-muted">加载中…</p> : null}
        <div className="sms-pagination">
          <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={historyPage <= 1 || historyLoading} onClick={() => void loadHistory(historyPage - 1)}>
            上一页
          </button>
          <span className="sms-page-info">第 {historyPage} 页</span>
          <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={historyLoading || history.length < HISTORY_PAGE_SIZE} onClick={() => void loadHistory(historyPage + 1)}>
            下一页
          </button>
        </div>
      </section>

      {insufficientOpen ? (
        <div className="sms-modal" role="dialog" aria-modal="true" aria-label="瓜皮不足">
          <button type="button" className="sms-modal-backdrop" onClick={() => setInsufficientOpen(false)} aria-label="关闭" />
          <div className="sms-modal-panel">
            <h3>瓜皮不足</h3>
            <p>
              当前：<strong>{insufficient.balance}</strong> 瓜皮
            </p>
            <p>
              本次需要：<strong>{insufficient.required}</strong> 瓜皮
            </p>
            <p className="sms-modal-tip">邀请好友或联系管理员充值后再试。</p>
            <button type="button" className="sms-btn sms-btn--primary sms-btn--block" onClick={() => setInsufficientOpen(false)}>
              知道了
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
