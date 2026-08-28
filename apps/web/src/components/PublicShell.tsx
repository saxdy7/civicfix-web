"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./PublicShell.module.css";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Live Map" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/accessibility", label: "Accessibility" },
];

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="CivicFix home">
          <svg className={styles.logoMark} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2.5c-3.9 0-7 3.1-7 7 0 5 7 12 7 12s7-7 7-12c0-3.9-3.1-7-7-7Z"
              fill="#0a0a0a"
            />
            <circle cx="12" cy="9.5" r="2.6" fill="#fff" />
          </svg>
        </Link>

        <nav className={styles.navPill} aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.headerActions}>
          <Link href="/sign-in" className={styles.actionPrimary}>
            Sign in
          </Link>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>CivicFix</span>
          <p className={styles.footerNote}>
            Report it. Track it. Get it fixed. AI suggestions are always reviewed by staff —
            never applied autonomously.
          </p>
        </div>
      </footer>
    </div>
  );
}
