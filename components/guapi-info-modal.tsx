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
            <p className="my-guapi-modal-sub">永久额度：注册 + 签到 + 推广 + 购买</p>
          </div>
          <button type="button" className="my-guapi-modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="my-guapi-modal-body">
          <p className="my-guapi-modal-lead">
            <strong>瓜皮</strong> 是永久站内额度。搜索不消耗；新资源可先预览约 10 秒，之后扣 1 瓜皮（短视频可看完）。
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
                <p>新资源预览约 10 秒后扣 1；不足 10 秒的视频可看完；重复观看不扣</p>
              </div>
            </li>
            <li>
              <span className="my-guapi-use-icon" aria-hidden>📅</span>
              <div>
                <strong>签到 / 推广 / 购买</strong>
                <p>每日签到、邀请好友、购买均可永久增加瓜皮</p>
              </div>
            </li>
          </ul>
          <p className="my-guapi-modal-foot">总瓜皮 = 注册赠送 + 签到 + 推广 + 购买。</p>
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
