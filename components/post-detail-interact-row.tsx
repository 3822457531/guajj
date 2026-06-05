"use client";

import { useCallback } from "react";

export function PostDetailInteractRow({ commentCount }: { commentCount: number }) {
  const goComment = useCallback(() => {
    document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("post-comment-body")?.focus(), 350);
  }, []);

  return (
    <div className="h5-detail-card-actions" role="group" aria-label="互动">
      <button type="button" className="h5-detail-card-actions-seg h5-detail-card-actions-btn" onClick={goComment}>
        <span className="h5-detail-card-actions-icon" aria-hidden>
          💬
        </span>
        <span>{commentCount}</span>
      </button>
    </div>
  );
}
