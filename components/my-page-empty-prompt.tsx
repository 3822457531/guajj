"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { GuestIdentityModal } from "@/components/guest-identity-modal";

export function MyPageEmptyPrompt({ variant }: { variant: "missing" | "invalid" }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(variant === "missing");

  const handleComplete = useCallback(() => {
    setModalOpen(false);
    router.refresh();
  }, [router]);

  const handleLeave = useCallback(() => {
    setModalOpen(false);
    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    }
  }, [router]);

  return (
    <>
      <div className="my-empty-card">
        {variant === "missing" ? (
          <span className="my-empty-icon" aria-hidden>
            🔐
          </span>
        ) : null}
        <p className="my-empty-title">{variant === "missing" ? "尚未创建身份" : "身份无效"}</p>
        <p className="my-empty-desc">
          {variant === "missing"
            ? "完成年龄确认后将自动生成本地加密身份。"
            : "请清理缓存后重新注册，或使用密钥恢复。"}
        </p>
        {variant === "missing" ? (
          <button type="button" className="my-empty-btn" onClick={() => setModalOpen(true)}>
            立即创建身份
          </button>
        ) : null}
      </div>
      {variant === "missing" && modalOpen ? (
        <GuestIdentityModal onComplete={handleComplete} onLeave={handleLeave} />
      ) : null}
    </>
  );
}
