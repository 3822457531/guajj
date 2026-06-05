"use client";

import { useCallback, useEffect, useState } from "react";

const FAV_KEY = "chigua:fav-posts";

function readFavSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** 顶栏与底栏收藏按钮同步（同页多处使用） */
export function usePostFavorite(postId: string) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    const sync = () => setFav(readFavSet().has(postId));
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAV_KEY || e.key === null) sync();
    };
    const onLocal = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("chigua-fav-changed", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("chigua-fav-changed", onLocal);
    };
  }, [postId]);

  const toggleFav = useCallback(() => {
    const set = readFavSet();
    if (set.has(postId)) set.delete(postId);
    else set.add(postId);
    localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
    setFav(set.has(postId));
    window.dispatchEvent(new Event("chigua-fav-changed"));
  }, [postId]);

  return { fav, toggleFav };
}
