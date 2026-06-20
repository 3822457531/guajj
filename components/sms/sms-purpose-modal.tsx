"use client";

import { useEffect, useState } from "react";

type SmsPurposeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SmsPurposeTipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="sms-purpose-tip-btn"
      onClick={onClick}
      aria-label="暗网手机号是做什么的？"
      title="暗网手机号是做什么的？"
    >
      <span aria-hidden>i</span>
    </button>
  );
}

export function SmsPurposeModal({ open, onClose }: SmsPurposeModalProps) {
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
    <div className="my-guapi-modal" role="dialog" aria-modal="true" aria-labelledby="sms-purpose-modal-title">
      <button type="button" className="my-guapi-modal-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="my-guapi-modal-panel">
        <div className="my-guapi-modal-head">
          <div className="my-guapi-modal-head-icon" aria-hidden>
            📱
          </div>
          <div>
            <h3 id="sms-purpose-modal-title" className="my-guapi-modal-title">
              暗网手机号是做什么的？
            </h3>
            <p className="my-guapi-modal-sub">临时匿名号码 · 收短信验证码</p>
          </div>
          <button type="button" className="my-guapi-modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="my-guapi-modal-body">
          <p className="my-guapi-modal-lead">
            获取<strong>临时匿名手机号</strong>，在各 App / 网站注册或登录时填写，用来
            <strong>接收短信验证码</strong>——无需暴露你的真实号码。
          </p>
          <ol className="sms-purpose-steps">
            <li>
              <strong>取号</strong>
              <span>先获取一个可用的暗网手机号</span>
            </li>
            <li>
              <strong>填号</strong>
              <span>在目标平台填写此号码，点击「获取验证码」</span>
            </li>
            <li>
              <strong>收码</strong>
              <span>回到这里输入关键词，拉取短信里的验证码</span>
            </li>
          </ol>
          <p className="my-guapi-modal-foot">与吃瓜搜索共用今日瓜皮，取号、收码按次扣费。</p>
        </div>
        <button type="button" className="my-guapi-modal-ok" onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  );
}

export function SmsPurposeTip() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SmsPurposeTipButton onClick={() => setOpen(true)} />
      <SmsPurposeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
