"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildReferralLink,
  readGuestIdentityBackup,
  saveGuestIdentityBackup
} from "@/lib/guest-identity-storage";

type MyPageClientProps = {
  publicId: string;
  referrerPublicId: string | null;
  usedToday: number;
  limit: number;
  remaining: number;
  searchBonus: number;
  referralCount: number;
  dailyBaseLimit: number;
  referralBonusPerInvite: number;
};

export function MyPageClient(props: MyPageClientProps) {
  const [secretVisible, setSecretVisible] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [recoverPublicId, setRecoverPublicId] = useState("");
  const [recoverSecret, setRecoverSecret] = useState("");
  const [recoverMsg, setRecoverMsg] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [secretKey, setSecretKey] = useState<string | null>(null);

  useEffect(() => {
    const backup = readGuestIdentityBackup();
    setSecretKey(backup?.publicId === props.publicId ? backup.secretKey : null);
  }, [props.publicId]);

  const referralLink = buildReferralLink(props.publicId);

  const copyText = useCallback(async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const handleRecover = useCallback(async () => {
    setRecovering(true);
    setRecoverMsg("");
    try {
      const res = await fetch("/api/guest/me", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicId: recoverPublicId.trim(), secretKey: recoverSecret.trim() })
      });
      if (!res.ok) {
        setRecoverMsg("身份或密钥不正确");
        return;
      }
      saveGuestIdentityBackup({
        publicId: recoverPublicId.trim(),
        secretKey: recoverSecret.trim()
      });
      setRecoverMsg("恢复成功，正在刷新…");
      window.location.reload();
    } catch {
      setRecoverMsg("恢复失败，请稍后重试");
    } finally {
      setRecovering(false);
    }
  }, [recoverPublicId, recoverSecret]);

  const rows: Array<{ label: string; value: string; copy?: string; masked?: boolean }> = [
    { label: "用户 ID", value: props.publicId, copy: props.publicId },
    {
      label: "密钥",
      value: secretKey ? (secretVisible ? secretKey : "••••••••••••••••") : "未在本地找到，请用下方恢复",
      copy: secretKey ?? undefined,
      masked: Boolean(secretKey)
    },
    { label: "推广码", value: props.publicId, copy: props.publicId },
    { label: "推广人", value: props.referrerPublicId ?? "无（直接访问）" },
    { label: "今日搜索", value: `${props.usedToday} / ${props.limit} 次（剩余 ${props.remaining}）` },
    { label: "邀请奖励", value: `+${props.searchBonus} 次（成功邀请 ${props.referralCount} 人）` },
    { label: "推广链接", value: referralLink, copy: referralLink }
  ];

  return (
    <div className="my-page-body">
      <section className="my-quota-banner">
        <p className="my-quota-title">今日搜索额度</p>
        <p className="my-quota-numbers">
          <strong>{props.remaining}</strong>
          <span> / {props.limit}</span>
        </p>
        {props.remaining <= 0 ? (
          <p className="my-quota-tip">
            次数已用完！分享下方链接给好友，每成功邀请一位自动 +{props.referralBonusPerInvite} 次（基础每日{" "}
            {props.dailyBaseLimit} 次）。
          </p>
        ) : (
          <p className="my-quota-tip">基础每日 {props.dailyBaseLimit} 次 + 邀请奖励 {props.searchBonus} 次</p>
        )}
      </section>

      <section className="my-identity-table" aria-label="我的身份">
        <table>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>
                  <span className="my-cell-value">{row.value}</span>
                  {row.masked && secretKey ? (
                    <button type="button" className="my-cell-btn" onClick={() => setSecretVisible((v) => !v)}>
                      {secretVisible ? "隐藏" : "显示"}
                    </button>
                  ) : null}
                  {row.copy ? (
                    <button type="button" className="my-cell-btn" onClick={() => void copyText(row.label, row.copy!)}>
                      {copiedField === row.label ? "已复制" : "复制"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="my-recover-card">
        <h2 className="my-recover-title">密钥恢复</h2>
        <p className="my-recover-desc">更换设备或清理缓存后，输入 ID 与密钥可恢复身份（本站无数据库找回）。</p>
        <div className="my-recover-fields">
          <input
            type="text"
            placeholder="GUA-123456"
            value={recoverPublicId}
            onChange={(e) => setRecoverPublicId(e.target.value)}
            className="my-recover-input"
          />
          <input
            type="text"
            placeholder="sk_xxxx_xxxx_xxxx_mxp"
            value={recoverSecret}
            onChange={(e) => setRecoverSecret(e.target.value)}
            className="my-recover-input"
          />
        </div>
        <button type="button" className="my-recover-btn" disabled={recovering} onClick={() => void handleRecover()}>
          {recovering ? "恢复中…" : "恢复身份"}
        </button>
        {recoverMsg ? <p className="my-recover-msg">{recoverMsg}</p> : null}
      </section>
    </div>
  );
}
