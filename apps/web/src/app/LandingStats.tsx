"use client";

import { useEffect, useRef } from "react";

import styles from "./landing.module.css";

interface StatSpec {
  icon: string;
  /** null means "no data to compute this from yet" — rendered as an em dash, never animated to a misleading 0. */
  target: number | null;
  suffix: string;
  decimals: number;
  label: string;
}

export interface LandingStatsData {
  reportsHandled: number;
  resolvedPct: number | null;
  activeResidents: number;
  medianTriageHours: number | null;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Real counts computed server-side from the database (see app/page.tsx) — a
// brand-new deployment legitimately starts at zero rather than showing
// invented traction numbers.
export function LandingStats({ reportsHandled, resolvedPct, activeResidents, medianTriageHours }: LandingStatsData) {
  const STATS: StatSpec[] = [
    { icon: "<", target: medianTriageHours, suffix: "h", decimals: 1, label: "Median Triage Time" },
    { icon: "%", target: resolvedPct, suffix: "%", decimals: 1, label: "Resolved Within SLA" },
    { icon: "*", target: reportsHandled, suffix: "", decimals: 0, label: "Reports Handled" },
    { icon: "#", target: activeResidents, suffix: "", decimals: 0, label: "Active Residents" },
  ];

  const rootRef = useRef<HTMLDivElement>(null);
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const format = (spec: StatSpec, value: number) =>
      `${value.toFixed(spec.decimals)}${spec.suffix}`;

    // Reduced motion: show final values immediately, no animation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      STATS.forEach((spec, i) => {
        const node = valueRefs.current[i];
        if (node) node.textContent = spec.target === null ? "—" : format(spec, spec.target);
      });
      return;
    }

    const timers: number[] = [];
    const frames: number[] = [];

    const run = () => {
      STATS.forEach((spec, i) => {
        const node = valueRefs.current[i];
        if (!node) return;

        // Nothing to count up to — show the "no data yet" dash directly.
        if (spec.target === null) {
          node.textContent = "—";
          return;
        }
        const target = spec.target;

        const duration = 1500 + i * 80;
        const startDelay = 480 + i * 90;

        timers.push(
          window.setTimeout(() => {
            const start = performance.now();
            const tick = (now: number) => {
              const progress = Math.min(1, (now - start) / duration);
              node.textContent = format(spec, target * easeOutCubic(progress));
              if (progress < 1) frames.push(requestAnimationFrame(tick));
            };
            frames.push(requestAnimationFrame(tick));
          }, startDelay),
        );
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(root);

    return () => {
      observer.disconnect();
      timers.forEach(window.clearTimeout);
      frames.forEach(cancelAnimationFrame);
    };
    // Deliberately depend on the primitive prop values, not the STATS array
    // (a new array identity every render) — this only re-runs the intro
    // animation if the underlying numbers actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsHandled, resolvedPct, activeResidents, medianTriageHours]);

  return (
    <div className={styles.stats} ref={rootRef}>
      {STATS.map((spec, i) => (
        <div
          key={spec.label}
          className={`${styles.stat} ${styles.anim}`}
          style={{ ["--d" as string]: `${0.5 + i * 0.08}s` }}
        >
          <span className={styles.statIcon} aria-hidden="true">
            {spec.icon}
          </span>
          <span
            className={styles.statValue}
            ref={(el) => {
              valueRefs.current[i] = el;
            }}
          >
            {spec.target === null ? "—" : `0${spec.suffix}`}
          </span>
          <span className={styles.statLabel}>{spec.label}</span>
        </div>
      ))}
    </div>
  );
}
