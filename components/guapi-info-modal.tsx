"use client";

import { useEffect } from "react";

type GuapiInfoModalProps = {
  open: boolean;
  onClose: () => void;
};

export function GuapiInfoModal({ open, onClose }: GuapiInfoModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="my-guapi-modal" role="dialog" aria-modal="true" aria-labelledby="guapi-modal-title">
      <button type="button" className="my-guapi-modal-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="my-guapi-modal-panel">
        <div className="my-guapi-modal-head">
          <div className="my-guapi-modal-head-icon" aria-hidden>🍉</div>
          <div>
            <h3 id="guapi-modal-title" className="my-guapi-modal-title">瓜皮能做什么？</h3>
            <p className="my-guapi-modal-sub">站内通用额度，邀请或购买可永久增加</p>
          </div>
          <button type="button" className="my-guapi-modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="my-guapi-modal-body">
          <p className="my-guapi-modal-lead">
            <strong>瓜皮</strong> 就是你的站内通用额度（原「搜索次数」）。搜索不消耗瓜皮，点进观看资源时扣除：
          </p>
          <ul className="my-guapi-use-list">
            <li>
              <span className="my-guapi-use-icon" aria-hidden>🔍</span>
              <div>
                <strong>全网搜索</strong>
                <p>全网暗网索引极搜，搜索免费不限关键词</p>
              </div>
            </li>
            <li>
              <span className="my-guapi-use-icon" aria-hidden>🍉</span>
              <div>
                <strong>观看资源</strong>
                <p>点进搜索结果观看内容，每次新资源扣 1 瓜皮，重复观看不扣</p>
              </div>
            </li>
            <li>
              <span className="my-guapi-use-icon" aria-hidden>💳</span>
              <div>
                <strong>购买瓜皮</strong>
                <p>支持微信/支付宝购买，到账后永久增加每日额度</p>
              </div>
            </li>
          </ul>
          <p className="my-guapi-modal-foot">可在「我的」购买瓜皮，也可邀请好友扫码注册获得额外额度。</p>
        </div>
        <button type="button" className="my-guapi-modal-ok" onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  );
}

export function GuapiHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="my-guapi-help-btn"
      onClick={onClick}
      aria-label="查看瓜皮用途"
      title="瓜皮能做什么？"
    >
      <span className="my-guapi-help-pulse" aria-hidden />
      <span className="my-guapi-help-inner">
        <span className="my-guapi-help-emoji" aria-hidden>🍉</span>
        <span className="my-guapi-help-text">用途</span>
      </span>
    </button>
  );
}
