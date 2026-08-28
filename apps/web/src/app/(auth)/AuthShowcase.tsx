import type { PlatformStats } from "@/lib/platform-stats";

import styles from "./auth.module.css";

interface AuthShowcaseProps {
  title: string;
  body: string;
  points: string[];
  stats: PlatformStats;
}

export function AuthShowcase({ title, body, points, stats }: AuthShowcaseProps) {
  return (
    <aside className={styles.showSide}>
      <div>
        <h2 className={styles.showTitle}>{title}</h2>
        <p className={styles.showBody}>{body}</p>
      </div>

      <ul className={styles.showList}>
        {points.map((point) => (
          <li key={point} className={styles.showItem}>
            <span className={styles.showTick} aria-hidden="true">
              ✓
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className={styles.showStats}>
        <div>
          <span className={styles.showStatValue}>{stats.reportsHandled}</span>
          <span className={styles.showStatLabel}>Reports handled</span>
        </div>
        <div>
          <span className={styles.showStatValue}>{stats.resolvedPct.toFixed(0)}%</span>
          <span className={styles.showStatLabel}>Resolved within SLA</span>
        </div>
        <div>
          <span className={styles.showStatValue}>{stats.medianTriageHours.toFixed(1)}h</span>
          <span className={styles.showStatLabel}>Median triage</span>
        </div>
      </div>
    </aside>
  );
}
