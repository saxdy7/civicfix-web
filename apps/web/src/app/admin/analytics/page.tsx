import { Card } from "@civicfix/ui-web";

import { isOverdue } from "@/lib/admin-mappers";
import { createServerSupabase } from "@/lib/supabase-server";
import { CATEGORY_LABEL } from "@/lib/status";
import type { IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

import styles from "../admin.module.css";

const CATEGORIES: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];

interface AnalyticsIssueRow {
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
  departments: { sla_hours: number } | null;
}

async function loadAnalytics() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("issues")
    .select("category, severity, status, created_at, updated_at, departments(sla_hours)")
    .is("deleted_at", null);

  const issues = (data ?? []) as unknown as AnalyticsIssueRow[];

  const counts = CATEGORIES.map((cat) => ({
    key: cat,
    label: CATEGORY_LABEL[cat],
    count: issues.filter((issue) => issue.category === cat).length,
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  const resolved = issues.filter((issue) => issue.status === "resolved");
  const medianDays =
    resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, issue) => {
            const days = (new Date(issue.updated_at).getTime() - new Date(issue.created_at).getTime()) / 86_400_000;
            return sum + days;
          }, 0) / resolved.length,
        )
      : 0;

  const overdueHighSeverity = issues.filter(
    (issue) =>
      (issue.severity === "high" || issue.severity === "critical") &&
      isOverdue(issue.created_at, issue.departments?.sla_hours ?? 72, issue.status),
  ).length;

  return { totalReports: issues.length, medianDays, overdueHighSeverity, counts, maxCount };
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
              <span className={styles.statValue}>{analytics.medianDays}d</span>
              <span className={styles.statLabel}>Median resolution time</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{analytics.overdueHighSeverity}</span>
              <span className={`${styles.statDelta} ${styles.deltaBad}`}>Overdue high-severity</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>—</span>
              <span className={styles.statLabel}>
                FCM delivery success — not tracked yet (no delivery job runner)
              </span>
            </Card>
          </div>

          <h2 className={styles.sectionTitle}>Reports by category</h2>
          <Card>
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
        </>
      )}
    </div>
  );
}
