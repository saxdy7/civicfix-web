import { Card } from "@civicfix/ui-web";

import { isOverdue } from "@/lib/admin-mappers";
import { createServerSupabase } from "@/lib/supabase-server";
import { CATEGORY_LABEL } from "@/lib/status";
import type { IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

import styles from "../admin.module.css";

const CATEGORIES: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];
const WEEKS = 8;

interface AnalyticsIssueRow {
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
  department_id: string | null;
  departments: { sla_hours: number } | null;
}

interface DepartmentRow {
  id: string;
  name: string;
  sla_hours: number;
}

interface HotspotRow {
  category: IssueCategory;
  latitude: number;
  longitude: number;
  report_count: number;
  neighborhood: string | null;
  last_reported_at: string;
}

const RESOLVED_LIKE: IssueStatus[] = ["resolved"];

async function loadAnalytics() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const [{ data }, { data: departmentRows }, { data: hotspotRows }] = await Promise.all([
    supabase
      .from("issues")
      .select("category, severity, status, created_at, updated_at, department_id, departments(sla_hours)")
      .is("deleted_at", null),
    supabase.from("departments").select("id, name, sla_hours").order("name", { ascending: true }),
    supabase.from("recurring_hotspots").select("*").limit(8),
  ]);

  const issues = (data ?? []) as unknown as AnalyticsIssueRow[];
  const departments = (departmentRows ?? []) as DepartmentRow[];
  const hotspots = (hotspotRows ?? []) as HotspotRow[];

  const counts = CATEGORIES.map((cat) => ({
    key: cat,
    label: CATEGORY_LABEL[cat],
    count: issues.filter((issue) => issue.category === cat).length,
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  const resolved = issues.filter((issue) => RESOLVED_LIKE.includes(issue.status));
  const medianDays =
    resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, issue) => {
            const days = (new Date(issue.updated_at).getTime() - new Date(issue.created_at).getTime()) / 86_400_000;
            return sum + days;
          }, 0) / resolved.length,
        )
      : 0;

  const resolutionRate = issues.length > 0 ? Math.round((resolved.length / issues.length) * 100) : 0;

  const overdueHighSeverity = issues.filter(
    (issue) =>
      (issue.severity === "high" || issue.severity === "critical") &&
      isOverdue(issue.created_at, issue.departments?.sla_hours ?? 72, issue.status),
  ).length;

  // Reports filed per week, oldest to newest, for the last WEEKS weeks.
  const weekBuckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (WEEKS - 1 - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end, count: 0 };
  });
  for (const issue of issues) {
    const created = new Date(issue.created_at);
    const bucket = weekBuckets.find((b) => created >= b.start && created < b.end);
    if (bucket) bucket.count += 1;
  }
  const maxWeekCount = Math.max(1, ...weekBuckets.map((b) => b.count));

  const departmentPerformance = departments.map((dept) => {
    const deptIssues = issues.filter((issue) => issue.department_id === dept.id);
    const deptResolved = deptIssues.filter((issue) => RESOLVED_LIKE.includes(issue.status));
    const deptOverdue = deptIssues.filter((issue) => isOverdue(issue.created_at, dept.sla_hours, issue.status)).length;
    return {
      name: dept.name,
      total: deptIssues.length,
      resolved: deptResolved.length,
      overdue: deptOverdue,
      rate: deptIssues.length > 0 ? Math.round((deptResolved.length / deptIssues.length) * 100) : null,
    };
  });

  return {
    totalReports: issues.length,
    medianDays,
    resolutionRate,
    overdueHighSeverity,
    counts,
    maxCount,
    weekBuckets,
    maxWeekCount,
    departmentPerformance,
    hotspots,
  };
}

export default async function AnalyticsPage() {
  const analytics = await loadAnalytics();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.subtitle}>Reporting, resolution, and SLA performance.</p>
      </div>

      {analytics === null ? (
        <Card>
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to see live analytics here.
          </p>
        </Card>
      ) : (
        <>
          <div className={styles.statGrid}>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{analytics.totalReports}</span>
              <span className={styles.statLabel}>Total reports</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{analytics.resolutionRate}%</span>
              <span className={styles.statLabel}>Resolution rate</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{analytics.medianDays}d</span>
              <span className={styles.statLabel}>Median resolution time</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{analytics.overdueHighSeverity}</span>
              <span className={`${styles.statDelta} ${styles.deltaBad}`}>Overdue high-severity</span>
            </Card>
          </div>

          <h2 className={styles.sectionTitle}>Reports by category</h2>
          <Card style={{ marginBottom: "var(--space-6)" }}>
            {analytics.totalReports === 0 ? (
              <p className={styles.emptyState}>No reports yet.</p>
            ) : (
              analytics.counts.map((item) => (
                <div key={item.key} className={styles.barRow}>
                  <span>{item.label}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(item.count / analytics.maxCount) * 100}%` }} />
                  </div>
                  <span>{item.count}</span>
                </div>
              ))
            )}
          </Card>

          <h2 className={styles.sectionTitle}>Reports over the last {WEEKS} weeks</h2>
          <Card style={{ marginBottom: "var(--space-6)" }}>
            {analytics.totalReports === 0 ? (
              <p className={styles.emptyState}>No reports yet.</p>
            ) : (
              analytics.weekBuckets.map((bucket) => (
                <div key={bucket.start.toISOString()} className={styles.barRow}>
                  <span>{bucket.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(bucket.count / analytics.maxWeekCount) * 100}%` }} />
                  </div>
                  <span>{bucket.count}</span>
                </div>
              ))
            )}
          </Card>

          <h2 className={styles.sectionTitle}>Department performance</h2>
          <Card style={{ marginBottom: "var(--space-6)" }}>
            {analytics.departmentPerformance.length === 0 ? (
              <p className={styles.emptyState}>No departments configured yet.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Total</th>
                      <th>Resolved</th>
                      <th>Resolution rate</th>
                      <th>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.departmentPerformance.map((dept) => (
                      <tr key={dept.name}>
                        <td>{dept.name}</td>
                        <td>{dept.total}</td>
                        <td>{dept.resolved}</td>
                        <td>{dept.rate === null ? "—" : `${dept.rate}%`}</td>
                        <td style={{ color: dept.overdue > 0 ? "var(--color-civic-red)" : undefined, fontWeight: dept.overdue > 0 ? 700 : 400 }}>
                          {dept.overdue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <h2 className={styles.sectionTitle}>Recurring hotspots</h2>
          <Card>
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
              Locations with 3 or more reports of the same category nearby each other — good candidates for a
              permanent fix instead of repeated patch-ups.
            </p>
            {analytics.hotspots.length === 0 ? (
              <p className={styles.emptyState}>No recurring hotspots detected yet.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Neighborhood</th>
                      <th>Reports</th>
                      <th>Last reported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.hotspots.map((h, i) => (
                      <tr key={`${h.category}-${h.latitude}-${h.longitude}-${i}`}>
                        <td>{CATEGORY_LABEL[h.category]}</td>
                        <td>{h.neighborhood ?? "Unknown"}</td>
                        <td>{h.report_count}</td>
                        <td>{new Date(h.last_reported_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
