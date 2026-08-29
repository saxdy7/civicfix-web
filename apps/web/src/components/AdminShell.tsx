"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CivicBotWidget } from "@/components/chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDashboardTheme } from "@/lib/dashboard-theme";

import styles from "./AdminShell.module.css";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/queue", label: "Issue queue" },
      { href: "/admin/assignments", label: "Assignment board" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/departments", label: "Departments & SLA" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/audit", label: "Daily audit" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/access-requests", label: "Access requests" },
      { href: "/admin/users", label: "Users & roles" },
    ],
  },
];

interface AdminUser {
  name: string;
  email: string;
  role: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AdminShell({
  children,
  user,
  pendingAccessRequests = 0,
}: {
  children: ReactNode;
  user: AdminUser;
  /** Real count of `staff_access_requests` with status='pending', fetched in admin/layout.tsx. */
  pendingAccessRequests?: number;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useDashboardTheme();

  return (
    <div className={styles.shell} data-theme={theme}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.5c-3.9 0-7 3.1-7 7 0 5 7 12 7 12s7-7 7-12c0-3.9-3.1-7-7-7Z"
                fill="#0a0a0a"
              />
              <circle cx="12" cy="9.5" r="2.6" fill="#fff" />
            </svg>
          </span>
          <span className={styles.brandName}>CivicFix</span>
        </Link>

        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.navGroup}>
            <span className={styles.navGroupLabel}>{group.label}</span>
            {group.items.map((item) => {
              const isActive =
                item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
              const badge = item.href === "/admin/access-requests" && pendingAccessRequests > 0
                ? pendingAccessRequests
                : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                >
                  <span className={styles.navLinkRow}>
                    {item.label}
                    {badge !== null ? <span className={styles.navBadge}>{badge}</span> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}

        <div className={styles.sidebarFooter}>
          <div className={styles.userCard}>
            <span className={styles.avatar}>{initials(user.name)}</span>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>{user.role}</div>
            </div>
          </div>
          <Link href="/" className={styles.backLink}>
            ← Back to public site
          </Link>
        </div>
      </aside>

      <div className={styles.column}>
        <header className={styles.topbar}>
          <input
            className={styles.search}
            placeholder="Search reports, tracking IDs, neighborhoods…"
            aria-label="Search"
          />
          <div className={styles.topbarActions}>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" className={styles.iconButton} aria-label="Notifications">
              ○
            </button>
            <button type="button" className={styles.iconButton} aria-label="Account">
              {initials(user.name)}
            </button>
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
      <CivicBotWidget />
    </div>
  );
}
