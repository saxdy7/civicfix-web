"use client";

import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CivicBotWidget } from "@/components/chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDashboardTheme } from "@/lib/dashboard-theme";

import { api } from "@convex/_generated/api";

import styles from "./ResidentShell.module.css";

interface ResidentUser {
  name: string;
  email: string;
}

function buildNavGroups(counts: { reports: number; notifications: number }) {
  return [
    {
      label: "My activity",
      items: [
        { href: "/app", label: "Overview" },
        { href: "/app/assistant", label: "🤖 AI Assistant" },
        { href: "/app/reports", label: "My reports", count: counts.reports },
        { href: "/app/community", label: "Community" },
        { href: "/app/notifications", label: "Notifications", count: counts.notifications },
      ],
    },
    {
      label: "Account",
      items: [{ href: "/app/profile", label: "Profile & privacy" }],
    },
  ];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ResidentShell({ children, user }: { children: ReactNode; user: ResidentUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { theme, toggleTheme } = useDashboardTheme();

  // Convex subscriptions — these update live with no manual refresh wiring
  // when a new report/notification lands, unlike the old one-shot SSR fetch.
  const myIssues = useQuery(api.issues.list, { onlyMine: true });
  const unreadCount = useQuery(api.notifications.unreadCount, {});
  const navGroups = buildNavGroups({ reports: myIssues?.length ?? 0, notifications: unreadCount ?? 0 });

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

        <span className={styles.portalTag}>Resident portal</span>

        <Link href="/app/report" className={styles.reportCta}>
          + Report an issue
        </Link>

        {navGroups.map((group) => (
          <div key={group.label} className={styles.navGroup}>
            <span className={styles.navGroupLabel}>{group.label}</span>
            {group.items.map((item) => {
              const isActive =
                item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                >
                  <span>{item.label}</span>
                  {"count" in item && item.count ? (
                    <span className={styles.navCount}>{item.count}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}

        <div className={styles.sidebarFooter}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <div className={styles.userCard}>
            <span className={styles.avatar}>{initials(user.name)}</span>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>Resident</div>
            </div>
          </div>
          <button
            type="button"
            className={styles.backLink}
            style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
            onClick={() => signOut(() => router.push("/"))}
          >
            Sign out
          </button>
          <Link href="/" className={styles.backLink}>
            ← Back to public site
          </Link>
        </div>
      </aside>

      <div className={styles.column}>
        <div className={styles.content}>{children}</div>
      </div>
      <CivicBotWidget />
    </div>
  );
}
