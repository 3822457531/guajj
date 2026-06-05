"use client";

import type { ReactNode } from "react";
import AdminLink from "@/components/admin-link";
import { normalizeAdminPathname } from "@/lib/admin-path";
import { useAdminPath } from "@/lib/admin-path-context";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import LogoutButton from "./logout-button";

type NavItem = { href: string; label: string; icon: ReactNode; end?: boolean };

function IconOverview() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function IconStorage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function IconTags() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconGuestUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <rect x="15" y="11" width="8" height="10" rx="1" />
      <path d="M17 15h4" />
    </svg>
  );
}

function isActive(pathname: string, item: NavItem) {
  if (item.end) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminSidebar({ username }: { username: string }) {
  const { path } = useAdminPath();
  const pathname = normalizeAdminPathname(usePathname() || "");

  const navItems: NavItem[] = useMemo(
    () => [
      { href: path(), label: "概览", icon: <IconOverview />, end: true },
      { href: path("/analytics"), label: "访问统计", icon: <IconChart /> },
      { href: path("/search-analytics"), label: "搜索统计", icon: <IconSearch /> },
      { href: path("/posts"), label: "内容", icon: <IconDoc /> },
      { href: path("/index-messages"), label: "索引内容", icon: <IconDoc /> },
      { href: path("/comments"), label: "评论", icon: <IconChat /> },
      // { href: path("/social-users"), label: "登录用户", icon: <IconUsers /> },
      { href: path("/users"), label: "用户", icon: <IconGuestUser /> },
      { href: path("/media"), label: "媒体", icon: <IconImage /> },
      { href: path("/storage"), label: "存储监控", icon: <IconStorage /> },
      { href: path("/taxonomy"), label: "分类标签", icon: <IconTags /> },
      { href: path("/telegram"), label: "TG机器人", icon: <IconSend /> },
      { href: path("/settings"), label: "设置", icon: <IconSettings /> }
    ],
    [path]
  );

  return (
    <aside className="admin-side">
      <AdminLink href="/" className="admin-sidebar-brand">
        <span className="admin-sidebar-logo" aria-hidden>
          🍉
        </span>
        <span className="admin-sidebar-title">吃瓜网</span>
      </AdminLink>

      <nav className="admin-sidebar-nav">
        {navItems.map((item) => (
          <AdminLink
            key={item.href}
            href={item.href}
            className={`admin-nav-link${isActive(pathname, item) ? " is-active" : ""}`}
          >
            <span className="admin-nav-icon">{item.icon}</span>
            {item.label}
          </AdminLink>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-user">
          <span className="admin-sidebar-user-avatar">{username.slice(0, 1).toUpperCase()}</span>
          <div className="admin-sidebar-user-meta">
            <span className="admin-sidebar-user-name">{username}</span>
            <span className="admin-sidebar-user-role">管理员</span>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
