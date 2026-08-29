import { fetchQuery } from "convex/nextjs";
import { Card } from "@civicfix/ui-web";

import { PublicShell } from "@/components/PublicShell";
import { getPlatformStats } from "@/lib/platform-stats";
import { CATEGORY_LABEL } from "@/lib/status";
import type { IssueCategory } from "@/lib/types";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import styles from "./page.module.css";

const CATEGORIES: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];
const HOTSPOT_GRID = 0.003; // ~300m at the equator — same grid-snap the admin analytics dashboard uses

interface Hotspot {
  category: IssueCategory;
  neighborhood: string;
  reportCount: number;
}

/** Groups nearby same-category reports into approximate hotspots — the Convex equivalent of the retired PostGIS `recurring_hotspots` view. */
function findHotspots(issues: Doc<"issues">[]): Hotspot[] {
  const buckets = new Map<string, Doc<"issues">[]>();
  for (const issue of issues) {
    const key = `${issue.category}:${Math.round(issue.latitude / HOTSPOT_GRID)}:${Math.round(issue.longitude / HOTSPOT_GRID)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(issue);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values())
    .filter((bucket) => bucket.length >= 3)
    .map((bucket) => ({
      category: bucket[0].category,
      neighborhood: bucket[0].neighborhood ?? "Unknown",
      reportCount: bucket.length,
    }))
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, 6);
}

async function loadTransparencyData() {
  // No token passed — issues.list already restricts an anonymous caller to
  // public, non-deleted rows server-side (see convex/issues.ts).
  const [stats, publicIssues, departments] = await Promise.all([
    getPlatformStats(),
    fetchQuery(api.issues.list, {}),
    fetchQuery(api.departments.list, {}),
  ]);

  const categoryCounts = CATEGORIES.map((cat) => ({
    key: cat,
    label: CATEGORY_LABEL[cat],
    total: publicIssues.filter((i) => i.category === cat).length,
    resolved: publicIssues.filter((i) => i.category === cat && i.status === "resolved").length,
  }));
  const maxCategoryCount = Math.max(1, ...categoryCounts.map((c) => c.total));

  const departmentPerformance = departments
    .map((dept) => {
      const deptIssues = publicIssues.filter((i) => i.departmentId === dept._id);
      const resolved = deptIssues.filter((i) => i.status === "resolved").length;
      return {
        name: dept.name,
        total: deptIssues.length,
        rate: deptIssues.length > 0 ? Math.round((resolved / deptIssues.length) * 100) : null,
      };
    })
    .filter((d) => d.total > 0);

  return {
    stats,
    categoryCounts,
    maxCategoryCount,
    departmentPerformance,
    hotspots: findHotspots(publicIssues),
  };
}

export default async function TransparencyPage() {
  const { stats, categoryCounts, maxCategoryCount, departmentPerformance, hotspots } = await loadTransparencyData();

  return (
    <PublicShell>
      <div className={styles.header}>
        <h1 className={styles.title}>Public transparency dashboard</h1>
        <p className={styles.subtitle}>
          City-wide civic issue performance, updated live. No personal or exact-location data is shown here —
          just what gets reported, how fast it gets fixed, and where problems keep coming back.
        </p>
      </div>

      <div className={styles.statGrid}>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.reportsHandled}</span>
          <span className={styles.statLabel}>Reports filed</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.resolvedPct === null ? "—" : `${Math.round(stats.resolvedPct)}%`}</span>
          <span className={styles.statLabel}>Resolved</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.activeResidents}</span>
          <span className={styles.statLabel}>Residents involved</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{stats.medianTriageHours === null ? "—" : `${Math.round(stats.medianTriageHours)}h`}</span>
          <span className={styles.statLabel}>Median time to triage</span>
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>Reports by category</h2>
      <Card style={{ marginBottom: "var(--space-6)" }}>
        {categoryCounts.length > 0 && maxCategoryCount ? (
          categoryCounts.map((item) => (
            <div key={item.key} className={styles.barRow}>
              <span>{item.label}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(item.total / maxCategoryCount) * 100}%` }} />
              </div>
              <span>
                {item.total} filed · {item.resolved} resolved
              </span>
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>No public reports yet.</p>
        )}
      </Card>

      <h2 className={styles.sectionTitle}>Department resolution performance</h2>
      <Card style={{ marginBottom: "var(--space-6)" }}>
        {departmentPerformance.length === 0 ? (
          <p className={styles.emptyState}>Not enough routed reports yet to show department performance.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Reports handled</th>
                  <th>Resolution rate</th>
                </tr>
              </thead>
              <tbody>
                {departmentPerformance.map((dept) => (
                  <tr key={dept.name}>
                    <td>{dept.name}</td>
                    <td>{dept.total}</td>
                    <td>{dept.rate === null ? "—" : `${dept.rate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className={styles.sectionTitle}>Recurring hotspots</h2>
      <Card>
        <p style={{ margin: "0 0 var(--space-3)", color: "var(--color-muted-foreground)" }}>
          Neighborhoods where the same kind of problem has been reported 3 or more times nearby each other.
        </p>
        {hotspots.length === 0 ? (
          <p className={styles.emptyState}>No recurring hotspots identified yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Neighborhood</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h, i) => (
                  <tr key={`${h.category}-${h.neighborhood}-${i}`}>
                    <td>{CATEGORY_LABEL[h.category]}</td>
                    <td>{h.neighborhood}</td>
                    <td>{h.reportCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PublicShell>
  );
}
