"use client";

import { matchesAdminRoute, normalizeAdminPathname } from "@/lib/admin-path";
import { usePathname } from "next/navigation";

const routes: { test: (p: string) => boolean; title: string; subtitle: string }[] = [
  { test: (p) => matchesAdminRoute(p, "/posts/preview"), title: "内容预览", subtitle: "核对封面、图集与视频" },
  { test: (p) => matchesAdminRoute(p, "/index-messages/preview"), title: "索引预览", subtitle: "核对图片、视频与混排块" },
  { test: (p) => matchesAdminRoute(p, "/index-messages"), title: "索引内容", subtitle: "TgIndexedMessage 编辑与批量删除" },
  { test: (p) => matchesAdminRoute(p, "/posts"), title: "内容管理", subtitle: "新建、编辑与检索全站内容" },
  { test: (p) => matchesAdminRoute(p, "/analytics"), title: "访问统计", subtitle: "PV/UV、IP 与登录用户访问明细" },
  { test: (p) => matchesAdminRoute(p, "/search-analytics"), title: "搜索统计", subtitle: "首页与 VIP 搜索明细、每日/每周热搜" },
  { test: (p) => matchesAdminRoute(p, "/comments"), title: "评论管理", subtitle: "审核与清理用户评论" },
  { test: (p) => matchesAdminRoute(p, "/social-users"), title: "登录用户", subtitle: "OAuth 用户与访问行为" },
  { test: (p) => matchesAdminRoute(p, "/users"), title: "用户", subtitle: "匿名加密身份（GUA 自动注册）" },
  { test: (p) => matchesAdminRoute(p, "/media"), title: "媒体库", subtitle: "上传与管理图片、视频资源" },
  { test: (p) => matchesAdminRoute(p, "/storage"), title: "存储监控", subtitle: "R2 与本地 uploads 用量、图片/视频数量" },
  { test: (p) => matchesAdminRoute(p, "/taxonomy"), title: "分类与标签", subtitle: "维护栏目与话题标签" },
  { test: (p) => matchesAdminRoute(p, "/telegram"), title: "TG 机器人", subtitle: "频道同步与导入配置" },
  { test: (p) => matchesAdminRoute(p, "/settings"), title: "站点设置", subtitle: "全站开关与策略" },
  { test: (p) => matchesAdminRoute(p), title: "后台概览", subtitle: "关键指标一眼掌握" }
];

function resolveMeta(pathname: string) {
  for (const r of routes) {
    if (r.test(pathname)) return { title: r.title, subtitle: r.subtitle };
  }
  return { title: "管理后台", subtitle: "" };
}

export default function AdminHeader({ username }: { username: string }) {
  const pathname = normalizeAdminPathname(usePathname() || "");
  const { title, subtitle } = resolveMeta(pathname);

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-titles">
        <h1 className="admin-topbar-title">{title}</h1>
        {subtitle ? <p className="admin-topbar-sub">{subtitle}</p> : null}
      </div>
      <div className="admin-topbar-actions">
        <button type="button" className="admin-icon-btn" aria-label="通知">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <details className="admin-user-menu">
          <summary className="admin-user-summary">
            <span className="admin-user-avatar" aria-hidden>
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span className="admin-user-name">{username}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="admin-user-dropdown">
            <span className="admin-user-dropdown-hint">已登录管理员</span>
          </div>
        </details>
      </div>
    </header>
  );
}
