"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  loadLubanBalanceAction,
  rechargeGuestGuapiAction,
  saveSmsApikeyAction,
  saveSmsPricingAction
} from "./actions";

type GuestRow = {
  id: string;
  publicId: string;
  searchBonus: number;
  createdAt: Date;
};

export function SmsAdminPanel({
  pricing,
  apikeyConfigured,
  apikeyMask,
  guests
}: {
  pricing: { get_number: number; get_sms: number; send_sms: number };
  apikeyConfigured: boolean;
  apikeyMask: string;
  guests: GuestRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [apikeyMsg, setApikeyMsg] = useState("");
  const [pricingMsg, setPricingMsg] = useState("");
  const [rechargeMsg, setRechargeMsg] = useState("");
  const [lubanBalance, setLubanBalance] = useState("");

  function onSaveApikey(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveSmsApikeyAction(fd);
      setApikeyMsg(res.message || "");
    });
  }

  function onSavePricing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveSmsPricingAction(fd);
      setPricingMsg(res.message || "");
    });
  }

  function onRecharge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await rechargeGuestGuapiAction(fd);
      setRechargeMsg(res.message || "");
    });
  }

  function refreshLubanBalance() {
    startTransition(async () => {
      const res = await loadLubanBalanceAction();
      setLubanBalance(res.balance != null ? `Luban 余额: ${res.balance}` : res.message || "未提供余额接口");
    });
  }

  return (
    <div className="sms-admin-grid">
      <section className="admin-panel" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 12px" }}>LubanSMS API Key</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          {apikeyConfigured ? (
            <span className="admin-flash success" style={{ display: "inline", padding: "2px 8px" }}>
              已配置 {apikeyMask}
            </span>
          ) : (
            <span style={{ color: "#c62828" }}>未配置</span>
          )}
        </p>
        <form onSubmit={onSaveApikey} className="form-grid">
          <input type="password" name="apikey" className="form-input" placeholder="输入 API Key 保存" />
          <button type="submit" className="btn primary" disabled={pending}>
            保存
          </button>
        </form>
        {apikeyMsg ? <p className="admin-flash success">{apikeyMsg}</p> : null}
      </section>

      <section className="admin-panel" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 12px" }}>瓜皮定价</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>对用户扣费以瓜皮为单位（整数）。</p>
        <form onSubmit={onSavePricing} className="form-grid">
          <label>
            请求号码（瓜皮/次）
            <input type="number" name="get_number" min={0} step={1} defaultValue={pricing.get_number} className="form-input" />
          </label>
          <label>
            获取短信（瓜皮/次）
            <input type="number" name="get_sms" min={0} step={1} defaultValue={pricing.get_sms} className="form-input" />
          </label>
          <label>
            发送短信（瓜皮/条）
            <input type="number" name="send_sms" min={0} step={1} defaultValue={pricing.send_sms} className="form-input" />
          </label>
          <button type="submit" className="btn primary" disabled={pending}>
            保存定价
          </button>
        </form>
        {pricingMsg ? <p className="admin-flash success">{pricingMsg}</p> : null}
      </section>

      <section className="admin-panel" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 12px" }}>Luban 账户余额</h2>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>管理端查看 Luban 后台余额；用户侧使用瓜皮。</p>
        <button type="button" className="btn secondary" disabled={pending} onClick={refreshLubanBalance}>
          刷新余额
        </button>
        {lubanBalance ? <p style={{ marginTop: 12 }}>{lubanBalance}</p> : null}
      </section>

      <section className="admin-panel" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 12px" }}>用户瓜皮充值</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          充值将永久增加用户邀请奖励瓜皮，与搜索、暗网手机号共用每日额度。
        </p>
        <form onSubmit={onRecharge} className="form-grid">
          <label>
            用户
            <select name="guestUserId" className="form-input" required defaultValue="">
              <option value="" disabled>
                选择用户
              </option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.publicId}（邀请奖励 +{g.searchBonus} 瓜皮）
                </option>
              ))}
            </select>
          </label>
          <label>
            充值瓜皮
            <input type="number" name="amount" min={1} step={1} className="form-input" required />
          </label>
          <label>
            备注
            <input type="text" name="remark" className="form-input" placeholder="可选" />
          </label>
          <button type="submit" className="btn primary" disabled={pending}>
            充值
          </button>
        </form>
        {rechargeMsg ? <p className="admin-flash success">{rechargeMsg}</p> : null}
      </section>
    </div>
  );
}
