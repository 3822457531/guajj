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
            <p className="my-guapi-modal-sub">站内通用额度，邀请好友可永久增加</p>
          </div>
          <button type="button" className="my-guapi-modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="my-guapi-modal-body">
          <p className="my-guapi-modal-lead">
            <strong>瓜皮</strong> 就是你的站内通用额度（原「搜索次数」）。消耗瓜皮即可使用：
          </p>
          <ul className="my-guapi-use-list">
            <li>
              <span className="my-guapi-use-icon" aria-hidden>🍉</span>
              <div>
                <strong>吃瓜搜索</strong>
                <p>全网暗网索引极搜，发现频道与直达资源</p>
              </div>
            </li>
            <li>
              <span className="my-guapi-use-icon" aria-hidden>📱</span>
              <div>
                <strong>暗网手机号</strong>
                <p>获取专用号码，后续将支持接收短信验证码</p>
              </div>
            </li>
          </ul>
          <p className="my-guapi-modal-foot">邀请好友扫码注册，你将获得额外瓜皮并永久累计。</p>
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
