"use client";

import { createContext, useContext, useMemo } from "react";

type AdminPathContextValue = {
  prefix: string;
  path: (suffix?: string) => string;
  apiPath: (suffix?: string) => string;
};

const AdminPathContext = createContext<AdminPathContextValue | null>(null);

const INTERNAL_ADMIN = "/admin";

function buildPath(prefix: string, suffix = ""): string {
  const s = suffix ? (suffix.startsWith("/") ? suffix : `/${suffix}`) : "";
  if (!s || s === "/") return prefix;
  return `${prefix}${s}`;
}

function buildApiPath(prefix: string, suffix = ""): string {
  const part = suffix ? (suffix.startsWith("/") ? suffix.slice(1) : suffix) : "";
  if (prefix === INTERNAL_ADMIN) {
    return part ? `/api/admin/${part}` : "/api/admin";
  }
  return part ? `${prefix}/api/${part}` : `${prefix}/api`;
}

export function AdminPathProvider({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      prefix,
      path: (suffix = "") => buildPath(prefix, suffix),
      apiPath: (suffix = "") => buildApiPath(prefix, suffix)
    }),
    [prefix]
  );
  return <AdminPathContext.Provider value={value}>{children}</AdminPathContext.Provider>;
}

export function useAdminPath() {
  const ctx = useContext(AdminPathContext);
  if (!ctx) {
    throw new Error("useAdminPath must be used within AdminPathProvider");
  }
  return ctx;
}
