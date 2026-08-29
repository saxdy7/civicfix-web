"use client";

import type { DashboardTheme } from "@/lib/dashboard-theme";

import styles from "./ThemeToggle.module.css";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: DashboardTheme;
  onToggle: () => void;
}) {
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={onToggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
    >
      {isLight ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <path
            d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.41 1.41M7.05 16.95l-1.41 1.41m0-12.72 1.41 1.41m10.9 10.9 1.41 1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <path
            d="M20.5 14.5a8.5 8.5 0 1 1-9-13 7 7 0 0 0 9 13Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span>{isLight ? "Light" : "Dark"}</span>
    </button>
  );
}
