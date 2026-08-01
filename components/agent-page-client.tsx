"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PayChannelIcon } from "@/components/pay-channel-icons";
import { ReferralQrShare } from "@/components/referral-qr-share";
import {
  buildAbsoluteReferralLink,
  buildReferralLink
} from "@/lib/guest-identity-storage";

type AgentStatus = {
  publicId: string;
  isAgent: boolean;
  agentAt: string | null;
  walletYuan: number;
  rates: { directRate: number; indirectRate: number; minWithdrawYuan: number };
  stats: {
    directCount: number;
    indirectCount: number;
    directCommissionYuan: number;
    indirectCommissionYuan: number;
  };
};

type PackageItem = { id: string; title: string; priceYuan: number };
type ChannelItem = { id: number; name: string; kind: "alipay" | "wechat" };
type CommissionItem = {
  id: string;
  level: string;
  amount: number;
  orderAmount: number;
  rate: number;
  fromPublicId: string;
  createdAt: string;
};
type WithdrawItem = {
  id: string;
  amount: number;
  channel: string;
  account: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function pct(rate: number) {
  return `${Math.round(rate * 10000) / 100}%`;
}

export function AgentPageClient() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");
  const [tradeNo, setTradeNo] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollStarted = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawItem[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawChannel, setWithdrawChannel] = useState<"alipay" | "wechat">("alipay");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawName, setWithdrawName] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [copied, setCopied] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setPolling(false);
  }, []);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/agent/status", { cache: "no-store" });
    const data = (await res.json()) as AgentStatus & { ok?: boolean; message?: string };
    if (!res.ok || !data.ok) {
      setLoadError(data.message || "加载失败");
      return null;
    }
    setStatus(data);
    setLoadError("");
    return data;
  }, []);

  const refreshLists = useCallback(async () => {
    const [cRes, wRes] = await Promise.all([
      fetch("/api/agent/commissions?page=1&size=20", { cache: "no-store" }),
      fetch("/api/agent/withdraw?page=1&size=20", { cache: "no-store" })
    ]);
    const cData = (await cRes.json()) as { ok?: boolean; items?: CommissionItem[] };
    const wData = (await wRes.json()) as { ok?: boolean; items?: WithdrawItem[] };
    if (cData.ok && cData.items) setCommissions(cData.items);
    if (wData.ok && wData.items) setWithdrawals(wData.items);
  }, []);

  const loadPackages = useCallback(async () => {
    const res = await fetch("/api/agent/packages", { cache: "no-store" });
    const data = (await res.json()) as {
      ok?: boolean;
      packages?: PackageItem[];
      channels?: ChannelItem[];
    };
    if (data.ok) {
      const pkgs = data.packages || [];
      const chs = data.channels || [];
      setPackages(pkgs);
      setChannels(chs);
      setPackageId((p) => p || pkgs[0]?.id || null);
      setChannelId((c) => c || chs[0]?.id || null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await refreshStatus();
      await loadPackages();
      if (s?.isAgent) await refreshLists();
    })();
    return () => stopPolling();
  }, [refreshStatus, loadPackages, refreshLists, stopPolling]);

  const queryOnce = useCallback(
    async (tn: string) => {
      try {
        const res = await fetch("/api/agent/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tradeNo: tn })
        });
        const data = (await res.json()) as {
          ok?: boolean;
          paid?: boolean;
          message?: string;
        };
        if (data.ok && data.paid) {
          stopPolling();
          setOrderMsg(data.message || "代理已开通");
          await refreshStatus();
          await refreshLists();
          return true;
        }
        if (!data.ok) setOrderMsg(data.message || "查单失败");
        return false;
      } catch {
        setOrderMsg("查单网络异常");
        return false;
      }
    },
    [refreshStatus, refreshLists, stopPolling]
  );

  const startPolling = useCallback(
    (tn: string) => {
      stopPolling();
      setPolling(true);
      pollStarted.current = Date.now();
      setOrderMsg("请完成支付，正在等待开通…");
      pollTimer.current = setInterval(() => {
        if (Date.now() - pollStarted.current > POLL_TIMEOUT_MS) {
          stopPolling();
          setOrderMsg("等待超时。若已付款，请点「我已付款」再查一次。");
          return;
        }
        void queryOnce(tn);
      }, POLL_MS);
      void queryOnce(tn);
    },
    [queryOnce, stopPolling]
  );

  const handleOrder = useCallback(async () => {
    if (!packageId || channelId == null) {
      setOrderMsg("请选择套餐与支付方式");
      return;
    }
    setOrdering(true);
    setOrderMsg("");
    try {
      const res = await fetch("/api/agent/order", {
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
        setOrderMsg(data.message || "下单失败");
        return;
      }
      setTradeNo(data.tradeNo);
      setPayUrl(data.payUrl);
      window.open(data.payUrl, "_blank", "noopener,noreferrer");
      startPolling(data.tradeNo);
    } catch {
      setOrderMsg("下单失败，请稍后重试");
    } finally {
      setOrdering(false);
    }
  }, [packageId, channelId, startPolling]);

  const handleWithdraw = useCallback(async () => {
    setWithdrawing(true);
    setWithdrawMsg("");
    try {
      const res = await fetch("/api/agent/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          channel: withdrawChannel,
          account: withdrawAccount,
          accountName: withdrawName
        })
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      setWithdrawMsg(data.message || (data.ok ? "已提交" : "失败"));
      if (data.ok) {
        setWithdrawAmount("");
        await refreshStatus();
        await refreshLists();
      }
    } catch {
      setWithdrawMsg("提交失败");
    } finally {
      setWithdrawing(false);
    }
  }, [withdrawAmount, withdrawChannel, withdrawAccount, withdrawName, refreshStatus, refreshLists]);

  if (loadError) {
    return (
      <div className="agent-page-body">
        <p className="my-empty-desc">{loadError}</p>
        <Link href="/my" className="my-empty-btn">
          返回我的
        </Link>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="agent-page-body">
        <p className="my-field-hint">加载中…</p>
      </div>
    );
  }

  const referralPath = buildReferralLink(status.publicId);

  if (!status.isAgent) {
    return (
      <div className="agent-page-body">
        <section className="my-panel agent-hero" aria-label="开通代理">
          <h2 className="my-panel-title">推广赚钱</h2>
          <p className="agent-lead">
            开通代理后，下级用户购买瓜皮，你可获得直推 {pct(status.rates.directRate)}、间推{" "}
            {pct(status.rates.indirectRate)} 提成。提现最低 {status.rates.minWithdrawYuan} 元。
          </p>

          {packages.length === 0 ? (
            <p className="my-field-hint">暂无可购套餐，请稍后再试</p>
          ) : (
            <>
              <p className="guapi-buy-label">选择开通套餐</p>
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
                    <PayChannelIcon kind={ch.kind} className="guapi-buy-channel-icon" />
                    <span className="guapi-buy-channel-name">
                      {ch.kind === "alipay" ? "支付宝" : "微信支付"}
                    </span>
                  </button>
                ))}
              </div>
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
              {orderMsg ? <p className="guapi-buy-status">{orderMsg}</p> : null}
              <div className="agent-actions">
                {polling ? (
                  <button
                    type="button"
                    className="my-recover-btn"
                    onClick={() => {
                      if (tradeNo) void queryOnce(tradeNo);
                    }}
                  >
                    我已付款，立即查单
                  </button>
                ) : (
                  <button
                    type="button"
                    className="my-recover-btn"
                    disabled={ordering || !packageId || channelId == null}
                    onClick={() => void handleOrder()}
                  >
                    {ordering ? "下单中…" : "支付开通代理"}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
        <Link href="/my" className="agent-back-link">
          ← 返回我的
        </Link>
      </div>
    );
  }

  return (
    <div className="agent-page-body">
      <section className="my-quota-card" aria-label="代理余额">
        <p className="my-quota-title">可提现余额</p>
        <p className="my-quota-numbers">
          <strong>¥{status.walletYuan.toFixed(2)}</strong>
        </p>
        <p className="my-quota-tip">
          直推 {pct(status.rates.directRate)} · 间推 {pct(status.rates.indirectRate)} · 最低提现{" "}
          {status.rates.minWithdrawYuan} 元
        </p>
      </section>

      <section className="my-panel" aria-label="团队数据">
        <h2 className="my-panel-title">团队与佣金</h2>
        <div className="my-stats-grid">
          <div className="my-stat">
            <span className="my-stat-value">{status.stats.directCount}</span>
            <span className="my-stat-label">直推人数</span>
          </div>
          <div className="my-stat">
            <span className="my-stat-value">{status.stats.indirectCount}</span>
            <span className="my-stat-label">间推人数</span>
          </div>
          <div className="my-stat">
            <span className="my-stat-value">¥{status.stats.directCommissionYuan.toFixed(2)}</span>
            <span className="my-stat-label">直推累计</span>
          </div>
          <div className="my-stat">
            <span className="my-stat-value">¥{status.stats.indirectCommissionYuan.toFixed(2)}</span>
            <span className="my-stat-label">间推累计</span>
          </div>
        </div>
      </section>

      <section className="my-panel my-panel--promo" aria-label="推广">
        <h2 className="my-panel-title">我的推广</h2>
        <ReferralQrShare
          publicId={status.publicId}
          referralPath={referralPath}
          copied={copied}
          onCopyLink={() => {
            void navigator.clipboard.writeText(buildAbsoluteReferralLink(status.publicId)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        />
      </section>

      <section className="my-panel" aria-label="申请提现">
        <h2 className="my-panel-title">申请提现</h2>
        <div className="agent-withdraw-form">
          <label>
            金额（元）
            <input
              className="my-recover-input"
              type="number"
              min={status.rates.minWithdrawYuan}
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </label>
          <div className="guapi-buy-channels">
            <button
              type="button"
              className={`guapi-buy-channel guapi-buy-channel--alipay${
                withdrawChannel === "alipay" ? " is-active" : ""
              }`}
              onClick={() => setWithdrawChannel("alipay")}
            >
              <PayChannelIcon kind="alipay" className="guapi-buy-channel-icon" />
              <span className="guapi-buy-channel-name">支付宝</span>
            </button>
            <button
              type="button"
              className={`guapi-buy-channel guapi-buy-channel--wechat${
                withdrawChannel === "wechat" ? " is-active" : ""
              }`}
              onClick={() => setWithdrawChannel("wechat")}
            >
              <PayChannelIcon kind="wechat" className="guapi-buy-channel-icon" />
              <span className="guapi-buy-channel-name">微信</span>
            </button>
          </div>
          <label>
            收款账号
            <input
              className="my-recover-input"
              value={withdrawAccount}
              onChange={(e) => setWithdrawAccount(e.target.value)}
              placeholder="手机号 / 邮箱 / 微信号"
            />
          </label>
          <label>
            姓名（可选）
            <input
              className="my-recover-input"
              value={withdrawName}
              onChange={(e) => setWithdrawName(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="my-recover-btn"
            disabled={withdrawing}
            onClick={() => void handleWithdraw()}
          >
            {withdrawing ? "提交中…" : "提交提现"}
          </button>
          {withdrawMsg ? <p className="my-recover-msg">{withdrawMsg}</p> : null}
        </div>
      </section>

      <section className="my-panel" aria-label="佣金明细">
        <h2 className="my-panel-title">佣金明细</h2>
        {commissions.length === 0 ? (
          <p className="my-field-hint">暂无佣金，邀请好友充值瓜皮后可获得提成</p>
        ) : (
          <ul className="agent-list">
            {commissions.map((c) => (
              <li key={c.id} className="agent-list-item">
                <div>
                  <strong>{c.level === "direct" ? "直推" : "间推"}</strong> · {c.fromPublicId}
                  <div className="agent-list-meta">
                    充值 ¥{c.orderAmount} × {pct(c.rate)}
                  </div>
                </div>
                <div className="agent-list-amount">+¥{c.amount.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="my-panel" aria-label="提现记录">
        <h2 className="my-panel-title">提现记录</h2>
        {withdrawals.length === 0 ? (
          <p className="my-field-hint">暂无提现记录</p>
        ) : (
          <ul className="agent-list">
            {withdrawals.map((w) => (
              <li key={w.id} className="agent-list-item">
                <div>
                  <strong>
                    {w.status === "pending" ? "审核中" : w.status === "approved" ? "已通过" : "已拒绝"}
                  </strong>
                  {" · "}
                  {w.channel === "alipay" ? "支付宝" : "微信"} {w.account}
                  {w.adminNote ? <div className="agent-list-meta">{w.adminNote}</div> : null}
                </div>
                <div className="agent-list-amount">¥{w.amount.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/my" className="agent-back-link">
        ← 返回我的
      </Link>
    </div>
  );
}
