"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StorageRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        router.refresh();
        window.setTimeout(() => setLoading(false), 800);
      }}
    >
      {loading ? "刷新中…" : "重新扫描"}
    </button>
  );
}
