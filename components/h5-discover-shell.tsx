"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export type DiscoverTab = "hot" | "search";

export function H5DiscoverShell({
  initialTab,
  hotPanel,
  searchPanel
}: {
  initialTab: DiscoverTab;
  hotPanel: ReactNode;
  searchPanel: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DiscoverTab>(initialTab);
  const [searchMounted, setSearchMounted] = useState(initialTab === "search");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (tab === "search") setSearchMounted(true);
  }, [tab]);

  useEffect(() => {
    const page = document.querySelector(".global-search-page");
    if (!page) return;
    if (tab !== "search") {
      page.classList.remove("is-landing");
      return;
    }
    const body = document.querySelector(".global-search-body.is-landing");
    if (body) page.classList.add("is-landing");
    else page.classList.remove("is-landing");
  }, [tab]);

  const switchTab = useCallback(
    (next: DiscoverTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      if (next !== "search") params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <>
      <nav className="discover-segment" aria-label="热搜与搜索">
        <button
          type="button"
          className={`discover-segment-tab${tab === "hot" ? " is-active" : ""}`}
          aria-current={tab === "hot" ? "page" : undefined}
          onClick={() => switchTab("hot")}
        >
          热搜
        </button>
        <button
          type="button"
          className={`discover-segment-tab${tab === "search" ? " is-active" : ""}`}
          aria-current={tab === "search" ? "page" : undefined}
          onClick={() => switchTab("search")}
        >
          搜索
        </button>
      </nav>

      <div className="discover-panels">
        <div className={`discover-panel${tab === "hot" ? " is-active" : ""}`} hidden={tab !== "hot"}>
          {hotPanel}
        </div>
        {searchMounted ? (
          <div className={`discover-panel discover-panel--search${tab === "search" ? " is-active" : ""}`} hidden={tab !== "search"}>
            {searchPanel}
          </div>
        ) : null}
      </div>
    </>
  );
}
