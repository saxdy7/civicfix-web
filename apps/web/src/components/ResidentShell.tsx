"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./ResidentShell.module.css";

interface ResidentUser {
  name: string;
  email: string;
}

interface ResidentCounts {
  reports: number;
  notifications: number;
}

function buildNavGroups(counts?: ResidentCounts) {
  return [
    {
      label: "My activity",
      items: [
        { href: "/app", label: "Overview" },
        { href: "/app/reports", label: "My reports", count: counts?.reports },
        { href: "/app/notifications", label: "Notifications", count: counts?.notifications },
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

export function ResidentShell({
  children,
  user,
  counts,
}: {
  children: ReactNode;
  user: ResidentUser;
  counts?: ResidentCounts;
}) {
  const pathname = usePathname();
  const navGroups = buildNavGroups(counts);

  return (
    <div className={styles.shell}>
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
          <div className={styles.userCard}>
            <span className={styles.avatar}>{initials(user.name)}</span>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>Resident</div>
            </div>
          </div>
          <Link href="/" className={styles.backLink}>
            ← Back to public site
          </Link>
        </div>
      </aside>

      <div className={styles.column}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
