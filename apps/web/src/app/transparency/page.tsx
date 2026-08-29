import { Card } from "@civicfix/ui-web";

import { PublicShell } from "@/components/PublicShell";
import { getPlatformStats } from "@/lib/platform-stats";
import { CATEGORY_LABEL } from "@/lib/status";
import { createServerSupabase } from "@/lib/supabase-server";
import type { IssueCategory } from "@/lib/types";

import styles from "./page.module.css";

const CATEGORIES: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];

interface HotspotRow {
  category: IssueCategory;
  report_count: number;
  neighborhood: string | null;
}

async function loadTransparencyData() {
  const supabase = await createServerSupabase();
  const stats = await getPlatformStats();

  if (!supabase) {
    return { stats, categoryCounts: [], departmentPerformance: [], hotspots: [] };
  }

  const [{ data: issueRows }, { data: departmentRows }, { data: hotspotRows }] = await Promise.all([
    supabase.from("issues").select("category, status").eq("is_public", true).is("deleted_at", null),
    supabase.from("departments").select("id, name"),
    supabase.from("recurring_hotspots").select("category, report_count, neighborhood").limit(6),
  ]);

  const issues = (issueRows ?? []) as { category: IssueCategory; status: string }[];
  const categoryCounts = CATEGORIES.map((cat) => ({
    key: cat,
    label: CATEGORY_LABEL[cat],
    total: issues.filter((i) => i.category === cat).length,
    resolved: issues.filter((i) => i.category === cat && i.status === "resolved").length,
  }));
  const maxCategoryCount = Math.max(1, ...categoryCounts.map((c) => c.total));

  const departments = (departmentRows ?? []) as { id: string; name: string }[];
  const departmentPerformance = await Promise.all(
    departments.map(async (dept) => {
      const [{ count: total }, { count: resolved }] = await Promise.all([
        supabase.from("issues").select("id", { count: "exact", head: true }).eq("department_id", dept.id).eq("is_public", true),
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("department_id", dept.id)
          .eq("is_public", true)
          .eq("status", "resolved"),
      ]);
      return {
        name: dept.name,
        total: total ?? 0,
        rate: total ? Math.round(((resolved ?? 0) / total) * 100) : null,
      };
    }),
  );

  return {
    stats,
    categoryCounts,
    maxCategoryCount,
    departmentPerformance: departmentPerformance.filter((d) => d.total > 0),
    hotspots: (hotspotRows ?? []) as HotspotRow[],
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
        {categoryCounts && categoryCounts.length > 0 && maxCategoryCount ? (
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
                    <td>{h.neighborhood ?? "Unknown"}</td>
                    <td>{h.report_count}</td>
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
