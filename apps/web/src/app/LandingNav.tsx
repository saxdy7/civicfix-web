"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./landing.module.css";

const LINKS = [
  { href: "/", label: "Home", active: true },
  { href: "/map", label: "Live Map", active: false },
  { href: "/how-it-works", label: "How It Works", active: false },
  { href: "/accessibility", label: "Accessibility", active: false },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 720) setOpen(false);
    };

    document.body.classList.add("menu-open");
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="CivicFix home">
          <svg
            className={styles.logoMark}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M12 2.5c-3.9 0-7 3.1-7 7 0 5 7 12 7 12s7-7 7-12c0-3.9-3.1-7-7-7Z"
              fill="#0a0a0a"
            />
            <circle cx="12" cy="9.5" r="2.6" fill="#fff" />
          </svg>
        </Link>

        <nav className={styles.navPill} aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${link.active ? styles.navLinkActive : ""}`}
              aria-current={link.active ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/sign-in" className={styles.signIn}>
          Sign in
        </Link>

        <button
          type="button"
          className={`${styles.burger} ${open ? styles.burgerOpen : ""}`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="landing-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.burgerBar} />
          <span className={styles.burgerBar} />
          <span className={styles.burgerBar} />
        </button>
      </header>

      {open ? (
        <>
          <div
            className={styles.overlay}
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <div className={styles.sheet} id="landing-menu">
            {LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.sheetLink} ${link.active ? styles.sheetLinkActive : ""}`}
                style={{ ["--ld" as string]: `${0.06 + i * 0.05}s` }}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              className={styles.sheetSignIn}
              style={{ ["--ld" as string]: "0.3s" }}
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          </div>
        </>
      ) : null}
    </>
  );
}
