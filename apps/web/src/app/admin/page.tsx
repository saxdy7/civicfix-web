import Link from "next/link";

import { Card } from "@civicfix/ui-web";

import { ApiStatus } from "@/components/ApiStatus";
import { StatusPill } from "@/components/StatusPill";
import { isOverdue } from "@/lib/admin-mappers";
import { createServerSupabase } from "@/lib/supabase-server";
import { CATEGORY_LABEL } from "@/lib/status";
import type { IssueCategory, IssueStatus } from "@/lib/types";

import styles from "./admin.module.css";

interface RecentIssueRow {
  id: string;
  tracking_id: string;
  category: IssueCategory;
  status: IssueStatus;
  neighborhood: string | null;
  updated_at: string;
  departments: { name: string } | null;
}

interface OverdueCheckRow {
  status: IssueStatus;
  created_at: string;
  departments: { sla_hours: number } | null;
}

async function loadDashboard() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const [openIssuesRes, overdueRowsRes, activeAssignmentsRes, pendingAccessRes, recentIssuesRes] =
    await Promise.all([
      supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("status", "in", "(resolved,rejected)"),
      supabase
        .from("issues")
        .select("status, created_at, departments(sla_hours)")
        .is("deleted_at", null)
        .not("status", "in", "(resolved,rejected,duplicate)"),
      supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .is("completed_at", null),
      supabase
        .from("staff_access_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("issues")
        .select("id, tracking_id, category, status, neighborhood, updated_at, departments(name)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

  const overdueRows = (overdueRowsRes.data ?? []) as unknown as OverdueCheckRow[];
  const overdueCount = overdueRows.filter((row) =>
    isOverdue(row.created_at, row.departments?.sla_hours ?? 72, row.status),
  ).length;

  return {
    openIssuesCount: openIssuesRes.count ?? 0,
    overdueCount,
    activeAssignmentsCount: activeAssignmentsRes.count ?? 0,
    pendingAccessRequestsCount: pendingAccessRes.count ?? 0,
    recentIssues: (recentIssuesRes.data ?? []) as unknown as RecentIssueRow[],
  };
}

export default async function AdminDashboardPage() {
  const dashboard = await loadDashboard();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Operations dashboard</h1>
        <p className={styles.subtitle}>Today&apos;s snapshot of triage, SLA, and field activity.</p>
      </div>

      {dashboard ? (
        <>
          <div className={styles.statGrid}>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{dashboard.openIssuesCount}</span>
              <span className={styles.statLabel}>Open issues</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{dashboard.overdueCount}</span>
              <span className={`${styles.statDelta} ${styles.deltaBad}`}>SLA overdue</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{dashboard.activeAssignmentsCount}</span>
              <span className={styles.statLabel}>Active assignments</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{dashboard.pendingAccessRequestsCount}</span>
              <span
                className={`${styles.statDelta} ${
                  dashboard.pendingAccessRequestsCount > 0 ? styles.deltaBad : styles.deltaGood
                }`}
              >
                Pending access requests
              </span>
            </Card>
          </div>

          <h2 className={styles.sectionTitle}>Backend connectivity</h2>
          <Card style={{ marginBottom: "var(--space-6)" }}>
            <ApiStatus />
          </Card>

          <h2 className={styles.sectionTitle}>Recent activity</h2>
          <Card>
            {dashboard.recentIssues.length === 0 ? (
              <p className={styles.emptyState}>No reports yet.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tracking ID</th>
                      <th>Category</th>
                      <th>Neighborhood</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentIssues.map((issue) => (
                      <tr key={issue.id}>
                        <td>
                          <Link href={`/admin/queue/${issue.id}`}>{issue.tracking_id}</Link>
                        </td>
                        <td>{CATEGORY_LABEL[issue.category]}</td>
                        <td>{issue.neighborhood ?? "Unknown"}</td>
                        <td>
                          <StatusPill status={issue.status} />
                        </td>
                        <td>{new Date(issue.updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to see live operations data here.
          </p>
        </Card>
      )}
    </div>
  );
}
