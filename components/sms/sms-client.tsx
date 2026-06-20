"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { GuapiHelpButton, GuapiInfoModal } from "@/components/guapi-info-modal";

type SmsPricing = { get_number: number; get_sms: number; send_sms: number };

type HistoryItem = { time: string; phone: string | null; message: string | null; provider?: string | null };
type GuapiLogItem = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
};

const PAGE_SIZE = 20;

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function CopyButton({
  label,
  text,
  copied,
  onCopy,
  className = ""
}: {
  label: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={`sms-copy-btn ${className}`.trim()} aria-label={label} title={label} onClick={onCopy}>
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export function SmsClient({
  publicId,
  guestReady,
  initialRemaining,
  initialLimit,
  initialUsed,
  searchBonus,
  dailyBaseLimit
}: {
  publicId: string | null;
  guestReady: boolean;
  initialRemaining: number;
  initialLimit: number;
  initialUsed: number;
  searchBonus: number;
  dailyBaseLimit: number;
}) {
  const [guapiInfoOpen, setGuapiInfoOpen] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [limit, setLimit] = useState(initialLimit);
  const [used, setUsed] = useState(initialUsed);
  const [pricing, setPricing] = useState<SmsPricing | null>(null);
  const quotaPercent = limit > 0 ? Math.min(100, Math.round((remaining / limit) * 100)) : 0;

  const [phoneInput, setPhoneInput] = useState("");
  const [currentPhone, setCurrentPhone] = useState("");
  const [loadingNum, setLoadingNum] = useState(false);
  const [numErr, setNumErr] = useState("");

  const [keyword, setKeyword] = useState("");
  const [smsResult, setSmsResult] = useState("");
  const [smsErr, setSmsErr] = useState("");
  const [loadingSms, setLoadingSms] = useState(false);

  const [releasePhone, setReleasePhone] = useState("");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const [guapiLog, setGuapiLog] = useState<GuapiLogItem[]>([]);
  const [guapiLogPage, setGuapiLogPage] = useState(1);
  const [guapiLogLoading, setGuapiLogLoading] = useState(false);
  const [guapiLogLoaded, setGuapiLogLoaded] = useState(false);

  const [recordTab, setRecordTab] = useState<"sms" | "guapi">("sms");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficient, setInsufficient] = useState({ balance: 0, required: 0 });

  const pricingBootstrapped = useRef(false);
  const guestBootstrapped = useRef(false);

  const copyText = useCallback(async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const loadGuapi = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/balance", { cache: "no-store" });
      const data = await readJson<{
        code?: number;
        data?: { remaining?: number; limit?: number; used?: number; balance?: number };
      }>(res);
      if (data.code === 0 && data.data) {
        setRemaining(data.data.remaining ?? data.data.balance ?? 0);
        if (typeof data.data.limit === "number") setLimit(data.data.limit);
        if (typeof data.data.used === "number") setUsed(data.data.used);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadPricing = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/pricing", { cache: "no-store" });
      const data = await readJson<{ code?: number; data?: SmsPricing }>(res);
      if (data.code === 0 && data.data) setPricing(data.data);
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
      const res = await fetch(`/api/sms/number?${params.toString()}`, { cache: "no-store" });
      const data = await readJson<{ code?: number; msg?: string; phone?: string; data?: { balance?: number; required?: number; code?: string } }>(res);
      if (res.status === 402 && data.data?.code === "INSUFFICIENT_GUAPI") {
        showInsufficient(data.data.balance ?? 0, data.data.required ?? 0);
        setNumErr(data.msg || "瓜皮不足");
        return;
      }
      if (data.code === 0 && data.phone) {
        setCurrentPhone(data.phone);
        setReleasePhone(data.phone);
        void loadGuapi();
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
    const phone = currentPhone || releasePhone;
    if (!phone) {
      setSmsErr("请先获取号码");
      return;
    }
    if (!keyword.trim()) {
      setSmsErr("请输入关键词");
      return;
    }
    setSmsErr("");
    setSmsResult("");
    setLoadingSms(true);
    try {
      const params = new URLSearchParams({ phone, keyword: keyword.trim() });
      const res = await fetch(`/api/sms/sms?${params.toString()}`, { cache: "no-store" });
      const data = await readJson<{ code?: number; msg?: string; data?: { balance?: number; required?: number; code?: string } }>(res);
      if (res.status === 402 && data.data?.code === "INSUFFICIENT_GUAPI") {
        showInsufficient(data.data.balance ?? 0, data.data.required ?? 0);
        setSmsErr(data.msg || "瓜皮不足");
        return;
      }
      if (data.code === 0) {
        setSmsResult(String(data.msg || "(无内容)"));
        void loadGuapi();
        void loadHistory(historyPage);
      } else {
        setSmsErr(data.msg || "未收到短信");
      }
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : "获取失败");
    } finally {
      setLoadingSms(false);
    }
  }

  async function releaseNumber() {
    const phone = releasePhone.trim();
    if (!phone) return;
    setReleaseMsg("");
    try {
      const res = await fetch("/api/sms/number/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = await readJson<{ code?: number; msg?: string }>(res);
      if (data.code === 0) {
        setReleaseMsg("已释放");
        if (currentPhone === phone) setCurrentPhone("");
        setReleaseOpen(false);
      } else {
        setReleaseMsg(data.msg || "释放失败");
      }
    } catch (e) {
      setReleaseMsg(e instanceof Error ? e.message : "释放失败");
    }
  }

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    setHistoryLoaded(true);
    try {
      const res = await fetch(`/api/sms/history?page=${page}&size=${PAGE_SIZE}`, { cache: "no-store" });
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

  const loadGuapiLog = useCallback(async (page = 1) => {
    setGuapiLogLoading(true);
    setGuapiLogLoaded(true);
    try {
      const res = await fetch(`/api/sms/balance-log?page=${page}&size=${PAGE_SIZE}`, { cache: "no-store" });
      const data = await readJson<{ code?: number; data?: { list?: GuapiLogItem[]; page?: number } }>(res);
      if (data.code === 0) {
        setGuapiLog(data.data?.list || []);
        setGuapiLogPage(data.data?.page ?? page);
      }
    } catch {
      setGuapiLog([]);
    } finally {
      setGuapiLogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pricingBootstrapped.current) {
      pricingBootstrapped.current = true;
      void loadPricing();
    }
  }, [loadPricing]);

  useEffect(() => {
    if (!guestReady || guestBootstrapped.current) return;
    guestBootstrapped.current = true;
    void loadGuapi();
    void loadHistory(1);
    void loadGuapiLog(1);
  }, [guestReady, loadGuapi, loadHistory, loadGuapiLog]);

  const activePhone = currentPhone || releasePhone;

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

  return (
    <div className="sms-layout">
      <section className="sms-quota-strip" aria-label="今日瓜皮余额">
        <div className="sms-quota-strip-main">
          <div className="sms-quota-strip-top">
            <span className="sms-quota-strip-label">
              今日瓜皮
              <GuapiHelpButton onClick={() => setGuapiInfoOpen(true)} />
            </span>
            {publicId ? <code className="sms-quota-strip-id">{publicId}</code> : null}
          </div>
          <p className="sms-quota-strip-numbers">
            <strong>{remaining}</strong>
            <span className="sms-quota-strip-sep">/</span>
            <span>{limit}</span>
          </p>
          <p className="sms-quota-strip-tip">
            基础 {dailyBaseLimit}/日 + 奖励 {searchBonus} · 已用 {used}
          </p>
        </div>
        <div className="sms-quota-strip-ring" style={{ "--my-quota-pct": `${quotaPercent}%` } as CSSProperties}>
          <span>{quotaPercent}%</span>
        </div>
      </section>

      {activePhone ? (
        <section className="sms-phone-hero" aria-label="当前暗网手机号">
          <div className="sms-phone-hero-glow" aria-hidden />
          <p className="sms-phone-hero-label">当前暗网手机号</p>
          <div className="sms-phone-hero-row">
            <button
              type="button"
              className="sms-phone-number"
              onClick={() => void copyText("phone", activePhone)}
              title="点击复制号码"
            >
              {formatPhoneDisplay(activePhone)}
            </button>
            <CopyButton
              label="复制号码"
              text={activePhone}
              copied={copiedField === "phone"}
              onCopy={() => void copyText("phone", activePhone)}
            />
          </div>
          <p className="sms-phone-hero-hint">点击号码可复制，去目标 App / 网站注册或登录时填写</p>
        </section>
      ) : null}

      <section className="sms-flow-card">
        <div className="sms-step">
          <div className="sms-step-head">
            <span className="sms-step-badge">1</span>
            <div className="sms-step-head-text">
              <h2 className="sms-step-title">获取暗网手机号</h2>
              {pricing ? <span className="sms-step-chip">-{pricing.get_number} 瓜皮</span> : null}
            </div>
          </div>
          <p className="sms-hint">不填则随机分配；填已有号码可继续收短信。</p>
          <input
            className="sms-input"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="指定号码（可选）"
            inputMode="tel"
          />
          <button type="button" className="sms-btn sms-btn--primary sms-btn--block" disabled={loadingNum} onClick={() => void requestNumber()}>
            {loadingNum ? "获取中…" : activePhone ? "重新获取" : "获取号码"}
          </button>
          {numErr ? <p className="sms-error">{numErr}</p> : null}
        </div>

        <div className="sms-step-divider" aria-hidden />

        <div className="sms-step">
          <div className="sms-step-head">
            <span className="sms-step-badge">2</span>
            <div className="sms-step-head-text">
              <h2 className="sms-step-title">接收验证码</h2>
              {pricing ? <span className="sms-step-chip">-{pricing.get_sms} 瓜皮</span> : null}
            </div>
          </div>
          <p className="sms-hint">
            {activePhone
              ? "目标平台发码后，输入短信关键词（如平台名）拉取验证码。"
              : "请先完成步骤 1 获取号码。"}
          </p>
          <input
            className="sms-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="短信关键词，如：百度"
            disabled={!activePhone}
          />
          <button
            type="button"
            className="sms-btn sms-btn--primary sms-btn--block"
            disabled={loadingSms || !activePhone}
            onClick={() => void fetchSms()}
          >
            {loadingSms ? "拉取中…" : "拉取验证码"}
          </button>
          {smsResult ? (
            <div className="sms-code-box">
              <div className="sms-code-box-head">
                <span>验证码内容</span>
                <CopyButton
                  label="复制验证码"
                  text={smsResult}
                  copied={copiedField === "sms"}
                  onCopy={() => void copyText("sms", smsResult)}
                  className="sms-copy-btn--ghost"
                />
              </div>
              <pre className="sms-sms-result">{smsResult}</pre>
            </div>
          ) : null}
          {smsErr ? <p className="sms-error">{smsErr}</p> : null}
        </div>

        {activePhone ? (
          <>
            <div className="sms-step-divider" aria-hidden />
            <div className="sms-step sms-step--release">
              {!releaseOpen ? (
                <button type="button" className="sms-release-toggle" onClick={() => setReleaseOpen(true)}>
                  不再使用此号码？释放 →
                </button>
              ) : (
                <div className="sms-release-panel">
                  <p className="sms-hint">释放后可换号，当前号码将不再保留。</p>
                  <input
                    className="sms-input"
                    value={releasePhone}
                    onChange={(e) => setReleasePhone(e.target.value)}
                    placeholder="要释放的手机号"
                    inputMode="tel"
                  />
                  <div className="sms-release-actions">
                    <button type="button" className="sms-btn sms-btn--secondary" onClick={() => setReleaseOpen(false)}>
                      取消
                    </button>
                    <button type="button" className="sms-btn sms-btn--danger" onClick={() => void releaseNumber()}>
                      确认释放
                    </button>
                  </div>
                  {releaseMsg ? <p className={releaseMsg === "已释放" ? "sms-success" : "sms-error"}>{releaseMsg}</p> : null}
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>

      <section className="sms-records-card">
        <div className="sms-tabs" role="tablist" aria-label="记录">
          <button
            type="button"
            role="tab"
            aria-selected={recordTab === "sms"}
            className={`sms-tab${recordTab === "sms" ? " is-active" : ""}`}
            onClick={() => setRecordTab("sms")}
          >
            短信记录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={recordTab === "guapi"}
            className={`sms-tab${recordTab === "guapi" ? " is-active" : ""}`}
            onClick={() => setRecordTab("guapi")}
          >
            瓜皮记录
          </button>
        </div>

        {recordTab === "sms" ? (
          <>
            <div className="sms-toolbar">
              <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={historyLoading} onClick={() => void loadHistory(historyPage)}>
                刷新
              </button>
              <span className="sms-page-info">第 {historyPage} 页</span>
            </div>
            {history.length ? (
              <ul className="sms-history-list">
                {history.map((item) => (
                  <li key={`${item.time}-${item.phone}`} className="sms-history-item">
                    <div className="sms-history-meta">
                      <time>{new Date(item.time).toLocaleString("zh-CN")}</time>
                      {item.phone ? (
                        <button type="button" className="sms-history-phone" onClick={() => void copyText(`hist-${item.time}`, item.phone!)}>
                          {item.phone}
                        </button>
                      ) : null}
                    </div>
                    <p className="sms-history-msg">{item.message}</p>
                  </li>
                ))}
              </ul>
            ) : historyLoaded && !historyLoading ? (
              <p className="sms-muted">暂无短信记录</p>
            ) : null}
            {historyLoading ? <p className="sms-muted">加载中…</p> : null}
            <div className="sms-pagination">
              <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={historyPage <= 1 || historyLoading} onClick={() => void loadHistory(historyPage - 1)}>
                上一页
              </button>
              <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={historyLoading} onClick={() => void loadHistory(historyPage + 1)}>
                下一页
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sms-toolbar">
              <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={guapiLogLoading} onClick={() => void loadGuapiLog(guapiLogPage)}>
                刷新
              </button>
              <span className="sms-page-info">第 {guapiLogPage} 页</span>
            </div>
            {guapiLog.length ? (
              <ul className="sms-guapi-log">
                {guapiLog.map((item) => (
                  <li key={item.id} className="sms-guapi-log-item">
                    <time>{new Date(item.createdAt).toLocaleString("zh-CN")}</time>
                    <span className="sms-guapi-log-desc">{item.description || item.type}</span>
                    <span className={item.amount > 0 ? "sms-amount sms-amount--plus" : "sms-amount sms-amount--minus"}>
                      {item.amount > 0 ? "+" : ""}
                      {item.amount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : guapiLogLoaded && !guapiLogLoading ? (
              <p className="sms-muted">暂无瓜皮记录</p>
            ) : null}
            {guapiLogLoading ? <p className="sms-muted">加载中…</p> : null}
            <div className="sms-pagination">
              <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={guapiLogPage <= 1 || guapiLogLoading} onClick={() => void loadGuapiLog(guapiLogPage - 1)}>
                上一页
              </button>
              <button type="button" className="sms-btn sms-btn--secondary sms-btn--sm" disabled={guapiLogLoading} onClick={() => void loadGuapiLog(guapiLogPage + 1)}>
                下一页
              </button>
            </div>
          </>
        )}
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

      <GuapiInfoModal open={guapiInfoOpen} onClose={() => setGuapiInfoOpen(false)} />
    </div>
  );
}
