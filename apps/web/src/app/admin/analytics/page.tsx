"use client";

import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { isOverdue } from "@/lib/admin-mappers";
import { CATEGORY_LABEL } from "@/lib/status";
import type { IssueCategory } from "@/lib/types";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import styles from "../admin.module.css";

const CATEGORIES: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];
const WEEKS = 8;
const RESOLVED_LIKE = "resolved";

/** Groups nearby (~300m grid) same-category issues to approximate recurring hotspots — the Convex equivalent of a PostGIS grid-snap query. */
function findHotspots(issues: Doc<"issues">[]) {
  const GRID = 0.003; // ~300m at the equator
  const buckets = new Map<string, Doc<"issues">[]>();
  for (const issue of issues) {
    if (!issue.isPublic) continue;
    const key = `${issue.category}:${Math.round(issue.latitude / GRID)}:${Math.round(issue.longitude / GRID)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(issue);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values())
    .filter((bucket) => bucket.length >= 3)
    .map((bucket) => ({
      category: bucket[0].category,
      neighborhood: bucket[0].neighborhood ?? "Unknown",
      count: bucket.length,
      lastReportedAt: Math.max(...bucket.map((i) => i.createdAt)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export default function AnalyticsPage() {
  const issues = useQuery(api.issues.list, {});
  const departments = useQuery(api.departments.list, {});
  const loading = issues === undefined || departments === undefined;

  const allIssues = issues ?? [];
  const allDepartments = departments ?? [];
  const deptById = new Map(allDepartments.map((d) => [d._id, d]));

  const counts = CATEGORIES.map((cat) => ({
    key: cat,
    label: CATEGORY_LABEL[cat],
    count: allIssues.filter((i) => i.category === cat).length,
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  const resolved = allIssues.filter((i) => i.status === RESOLVED_LIKE);
  const medianDays =
    resolved.length > 0
      ? Math.round(resolved.reduce((sum, i) => sum + (i.updatedAt - i.createdAt) / 86_400_000, 0) / resolved.length)
      : 0;
  const resolutionRate = allIssues.length > 0 ? Math.round((resolved.length / allIssues.length) * 100) : 0;

  const overdueHighSeverity = allIssues.filter(
    (i) =>
      (i.severity === "high" || i.severity === "critical") &&
      isOverdue(i.createdAt, i.departmentId ? (deptById.get(i.departmentId)?.slaHours ?? 72) : 72, i.status),
  ).length;

  const weekBuckets = Array.from({ length: WEEKS }, (_, idx) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (WEEKS - 1 - idx) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end, count: 0 };
  });
  for (const issue of allIssues) {
    const created = new Date(issue.createdAt);
    const bucket = weekBuckets.find((b) => created >= b.start && created < b.end);
    if (bucket) bucket.count += 1;
  }
  const maxWeekCount = Math.max(1, ...weekBuckets.map((b) => b.count));

  const departmentPerformance = allDepartments.map((dept) => {
    const deptIssues = allIssues.filter((i) => i.departmentId === dept._id);
    const deptResolved = deptIssues.filter((i) => i.status === RESOLVED_LIKE);
    const deptOverdue = deptIssues.filter((i) => isOverdue(i.createdAt, dept.slaHours, i.status)).length;
    return {
      name: dept.name,
      total: deptIssues.length,
      resolved: deptResolved.length,
      overdue: deptOverdue,
      rate: deptIssues.length > 0 ? Math.round((deptResolved.length / deptIssues.length) * 100) : null,
    };
  });

  const hotspots = findHotspots(allIssues);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.subtitle}>Reporting, resolution, and SLA performance.</p>
      </div>

      {loading ? (
        <Card>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      ) : (
        <>
          <div className={styles.statGrid}>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{allIssues.length}</span>
              <span className={styles.statLabel}>Total reports</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{resolutionRate}%</span>
              <span className={styles.statLabel}>Resolution rate</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{medianDays}d</span>
              <span className={styles.statLabel}>Median resolution time</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{overdueHighSeverity}</span>
              <span className={`${styles.statDelta} ${styles.deltaBad}`}>Overdue high-severity</span>
            </Card>
          </div>

          <h2 className={styles.sectionTitle}>Reports by category</h2>
          <Card style={{ marginBottom: "var(--space-6)" }}>
            {allIssues.length === 0 ? (
              <p className={styles.emptyState}>No reports yet.</p>
            ) : (
              counts.map((item) => (
                <div key={item.key} className={styles.barRow}>
                  <span>{item.label}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(item.count / maxCount) * 100}%` }} />
                  </div>
                  <span>{item.count}</span>
                </div>
              ))
            )}
          </Card>

          <h2 className={styles.sectionTitle}>Reports over the last {WEEKS} weeks</h2>
          <Card style={{ marginBottom: "var(--space-6)" }}>
            {allIssues.length === 0 ? (
              <p className={styles.emptyState}>No reports yet.</p>
            ) : (
              weekBuckets.map((bucket) => (
                <div key={bucket.start.toISOString()} className={styles.barRow}>
                  <span>{bucket.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(bucket.count / maxWeekCount) * 100}%` }} />
                  </div>
                  <span>{bucket.count}</span>
                </div>
              ))
            )}
          </Card>

          <h2 className={styles.sectionTitle}>Department performance</h2>
          <Card style={{ marginBottom: "var(--space-6)" }}>
            {departmentPerformance.length === 0 ? (
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
                    {departmentPerformance.map((dept) => (
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
            {hotspots.length === 0 ? (
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
                    {hotspots.map((h, i) => (
                      <tr key={`${h.category}-${h.neighborhood}-${i}`}>
                        <td>{CATEGORY_LABEL[h.category]}</td>
                        <td>{h.neighborhood}</td>
                        <td>{h.count}</td>
                        <td>{new Date(h.lastReportedAt).toLocaleDateString()}</td>
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
