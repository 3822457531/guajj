"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminPath } from "@/lib/admin-path";

const PREFIX_OPTIONS = [
  "uploads/tg-index/",
  "uploads/tg-search/",
  "uploads/telegram/",
  "uploads/"
];

export function StoragePrefixPicker({ currentPrefix }: { currentPrefix: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prefix, setPrefix] = useState(currentPrefix);

  function applyPrefix(next: string) {
    setPrefix(next);
    startTransition(() => {
      router.push(`${adminPath("/storage")}?prefix=${encodeURIComponent(next)}`);
    });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
      <label htmlFor="storage-prefix" style={{ fontSize: 13, fontWeight: 700 }}>
        浏览前缀
      </label>
      <select
        id="storage-prefix"
        value={prefix}
        disabled={pending}
        onChange={(e) => applyPrefix(e.target.value)}
        style={{ minWidth: 220, padding: "8px 10px", borderRadius: 8 }}
      >
        {PREFIX_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={prefix}
        disabled={pending}
        onChange={(e) => setPrefix(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyPrefix(prefix.trim() || "uploads/");
          }
        }}
        placeholder="uploads/tg-index/…"
        style={{ flex: 1, minWidth: 200, padding: "8px 10px", borderRadius: 8 }}
      />
      <button type="button" className="btn secondary" disabled={pending} onClick={() => applyPrefix(prefix.trim() || "uploads/")}>
        查看
      </button>
    </div>
  );
}
