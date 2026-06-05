"use client";

import { useCallback } from "react";

export function PostDetailBottomBar() {
  const goComment = useCallback(() => {
    document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById("post-comment-body")?.focus();
    }, 350);
  }, []);

  return (
    <div className="h5-detail-dock">
      <button type="button" className="h5-detail-dock-input" onClick={goComment}>
        <span className="h5-detail-dock-pen" aria-hidden>
          ✎
        </span>
        说点什么…
      </button>
    </div>
  );
}
