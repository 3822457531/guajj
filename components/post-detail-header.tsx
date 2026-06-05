"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function PostDetailHeader() {
  const router = useRouter();

  return (
    <header className="h5-detail-topbar">
      <button type="button" className="h5-detail-back" onClick={() => router.back()} aria-label="返回">
        ‹
      </button>
      <Link href="/" className="h5-detail-brand h5-detail-brand-link">
        🔥 吃瓜网
      </Link>
      <span className="h5-detail-topbar-trail" aria-hidden />
    </header>
  );
}
