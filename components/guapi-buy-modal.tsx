"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PackageItem = {
  id: string;
  title: string;
  guapiAmount: number;
  priceYuan: number;
};

type ChannelItem = {
  id: number;
  name: string;
  kind: "alipay" | "wechat";
};

type GuapiBuyModalProps = {
  open: boolean;
  onClose: () => void;
  onPaid?: (quota: { remaining: number; limit: number; used: number; searchBonus: number }) => void;
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function GuapiBuyModal({ open, onClose, onPaid }: GuapiBuyModalProps) {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [packageId, setPackageId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [tradeNo, setTradeNo] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollStartedAt = useRef<number>(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setPolling(false);
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/pay/packages", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        packages?: PackageItem[];
        channels?: ChannelItem[];
        message?: string;
      };
      if (!data.ok) {
        setLoadError(data.message || "加载失败");
        return;
      }
      const pkgs = data.packages || [];
      const chs = data.channels || [];
      setPackages(pkgs);
      setChannels(chs);
      setPackageId((prev) => prev || pkgs[0]?.id || null);
      setChannelId((prev) => prev || chs[0]?.id || null);
    } catch {
      setLoadError("加载套餐失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void loadCatalog();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !polling) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      stopPolling();
    };
  }, [open, onClose, loadCatalog, stopPolling, polling]);

  const queryOnce = useCallback(
    async (tn: string) => {
      try {
        const res = await fetch("/api/pay/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tradeNo: tn })
        });
        const data = (await res.json()) as {
          ok?: boolean;
          paid?: boolean;
          message?: string;
          quota?: { remaining: number; limit: number; used: number; searchBonus: number };
        };
        if (data.ok && data.paid) {
          stopPolling();
          setStatusMsg(data.message || "支付成功，瓜皮已到账");
          if (data.quota) onPaid?.(data.quota);
          return true;
        }
        if (!data.ok) {
          setStatusMsg(data.message || "查单失败");
        }
        return false;
      } catch {
        setStatusMsg("查单网络异常");
        return false;
      }
    },
    [onPaid, stopPolling]
  );

  const startPolling = useCallback(
    (tn: string) => {
      stopPolling();
      setPolling(true);
      pollStartedAt.current = Date.now();
      setStatusMsg("请完成支付，正在等待到账…");
      pollTimer.current = setInterval(() => {
        if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
          stopPolling();
          setStatusMsg("等待超时。若已付款，请稍后回到「我的」再点购买核对，或联系管理员。");
          return;
        }
        void queryOnce(tn);
      }, POLL_INTERVAL_MS);
      void queryOnce(tn);
    },
    [queryOnce, stopPolling]
  );

  const handleOrder = useCallback(async () => {
    if (!packageId || channelId == null) {
      setStatusMsg("请选择套餐与支付方式");
      return;
    }
    setOrdering(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/pay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId, channelId })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        tradeNo?: string;
        payUrl?: string;
      };
      if (!data.ok || !data.tradeNo || !data.payUrl) {
        setStatusMsg(data.message || "下单失败");
        return;
      }
      setTradeNo(data.tradeNo);
      setPayUrl(data.payUrl);
      window.open(data.payUrl, "_blank", "noopener,noreferrer");
      startPolling(data.tradeNo);
    } catch {
      setStatusMsg("下单失败，请稍后重试");
    } finally {
      setOrdering(false);
    }
  }, [packageId, channelId, startPolling]);

  if (!open) return null;

  return (
    <div className="my-guapi-modal" role="dialog" aria-modal="true" aria-labelledby="guapi-buy-title">
      <button
        type="button"
        className="my-guapi-modal-backdrop"
        onClick={() => {
          if (!polling) onClose();
        }}
        aria-label="关闭"
      />
      <div className="my-guapi-modal-panel guapi-buy-panel">
        <div className="my-guapi-modal-head">
          <div className="my-guapi-modal-head-icon" aria-hidden>
            🍉
          </div>
          <div>
            <h3 id="guapi-buy-title" className="my-guapi-modal-title">
              购买瓜皮
            </h3>
            <p className="my-guapi-modal-sub">支付成功后永久增加额度</p>
          </div>
          <button
            type="button"
            className="my-guapi-modal-close"
            onClick={() => {
              if (!polling) onClose();
            }}
            aria-label="关闭"
            disabled={polling}
          >
            ✕
          </button>
        </div>

        <div className="my-guapi-modal-body guapi-buy-body">
          {loading ? <p className="my-field-hint">加载套餐中…</p> : null}
          {loadError ? <p className="guapi-buy-error">{loadError}</p> : null}

          {!loading && !loadError && packages.length === 0 ? (
            <p className="my-field-hint">暂无在售套餐，请稍后再试</p>
          ) : null}

          {packages.length > 0 ? (
            <>
              <p className="guapi-buy-label">选择套餐</p>
              <ul className="guapi-buy-packages">
                {packages.map((pkg) => (
                  <li key={pkg.id}>
                    <button
                      type="button"
                      className={`guapi-buy-pkg${packageId === pkg.id ? " is-active" : ""}`}
                      onClick={() => setPackageId(pkg.id)}
                      disabled={polling || ordering}
                    >
                      <span className="guapi-buy-pkg-title">{pkg.title}</span>
                      <span className="guapi-buy-pkg-meta">
                        <strong>{pkg.guapiAmount}</strong> 瓜皮
                      </span>
                      <span className="guapi-buy-pkg-price">¥{pkg.priceYuan}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <p className="guapi-buy-label">支付方式</p>
              <div className="guapi-buy-channels">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`guapi-buy-channel guapi-buy-channel--${ch.kind}${
                      channelId === ch.id ? " is-active" : ""
                    }`}
                    onClick={() => setChannelId(ch.id)}
                    disabled={polling || ordering}
                  >
                    {ch.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {tradeNo ? (
            <p className="guapi-buy-trade">
              订单号 <code>{tradeNo}</code>
              {payUrl ? (
                <>
                  {" · "}
                  <a href={payUrl} target="_blank" rel="noopener noreferrer">
                    重新打开付款页
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          {statusMsg ? <p className={`guapi-buy-status${polling ? " is-polling" : ""}`}>{statusMsg}</p> : null}
        </div>

        <div className="guapi-buy-actions">
          {polling ? (
            <button
              type="button"
              className="my-guapi-modal-ok"
              onClick={() => {
                if (tradeNo) void queryOnce(tradeNo);
              }}
            >
              我已付款，立即查单
            </button>
          ) : (
            <button
              type="button"
              className="my-guapi-modal-ok"
              disabled={ordering || !packageId || channelId == null || packages.length === 0}
              onClick={() => void handleOrder()}
            >
              {ordering ? "下单中…" : "去支付"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
