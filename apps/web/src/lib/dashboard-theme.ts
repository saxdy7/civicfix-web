"use client";

import { useCallback, useSyncExternalStore } from "react";

export type DashboardTheme = "light" | "dark";

const STORAGE_KEY = "civicfix-dashboard-theme";

function isDashboardTheme(value: unknown): value is DashboardTheme {
  return value === "light" || value === "dark";
}

function getSnapshot(): DashboardTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isDashboardTheme(stored) ? stored : "light";
}

// Server (and the very first client paint, before hydration reconciles
// against the real localStorage value) always renders light — this must
// match `getSnapshot`'s fallback exactly or React logs a hydration mismatch.
function getServerSnapshot(): DashboardTheme {
  return "light";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

/**
 * Resident and admin dashboards default to light and can be switched to
 * dark, independent of the always-dark landing/sign-in/sign-up pages (which
 * never call this — they use the dark tokens in :root directly). The choice
 * is shared across both portals via one localStorage key.
 */
export function useDashboardTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const next: DashboardTheme = getSnapshot() === "light" ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, next);
    // The native `storage` event only fires in other tabs/documents; dispatch
    // it locally too so this tab's own toggle click re-renders immediately.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return { theme, toggleTheme };
}
