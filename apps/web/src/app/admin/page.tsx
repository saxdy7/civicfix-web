"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { isOverdue } from "@/lib/admin-mappers";
import { CATEGORY_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";

import styles from "./admin.module.css";

export default function AdminDashboardPage() {
  const issues = useQuery(api.issues.list, {});
  const departments = useQuery(api.departments.list, {});
  const assignments = useQuery(api.assignments.listAll, {});
  const accessRequests = useQuery(api.staffAccessRequests.list, {});

  const loading = issues === undefined || departments === undefined || assignments === undefined || accessRequests === undefined;

  const deptById = new Map((departments ?? []).map((d) => [d._id, d]));
  const openIssues = (issues ?? []).filter((i) => !["resolved", "rejected"].includes(i.status));
  const overdueCount = openIssues.filter((i) =>
    isOverdue(i.createdAt, i.departmentId ? (deptById.get(i.departmentId)?.slaHours ?? 72) : 72, i.status),
  ).length;
  const activeAssignmentsCount = (assignments ?? []).filter((a) => !a.completedAt).length;
  const pendingAccessCount = (accessRequests ?? []).filter((r) => r.status === "pending").length;
  const recentIssues = [...(issues ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Operations dashboard</h1>
        <p className={styles.subtitle}>Today&apos;s snapshot of triage, SLA, and field activity.</p>
      </div>

      {loading ? (
        <Card>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      ) : (
        <>
          <div className={styles.statGrid}>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{openIssues.length}</span>
              <span className={styles.statLabel}>Open issues</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{overdueCount}</span>
              <span className={`${styles.statDelta} ${styles.deltaBad}`}>SLA overdue</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{activeAssignmentsCount}</span>
              <span className={styles.statLabel}>Active assignments</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{pendingAccessCount}</span>
              <span className={`${styles.statDelta} ${pendingAccessCount > 0 ? styles.deltaBad : styles.deltaGood}`}>
                Pending access requests
              </span>
            </Card>
          </div>

          <h2 className={styles.sectionTitle}>Recent activity</h2>
          <Card>
            {recentIssues.length === 0 ? (
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
                    {recentIssues.map((issue) => (
                      <tr key={issue._id}>
                        <td>
                          <Link href={`/admin/queue/${issue._id}`}>{issue.trackingId}</Link>
                        </td>
                        <td>{CATEGORY_LABEL[issue.category]}</td>
                        <td>{issue.neighborhood ?? "Unknown"}</td>
                        <td>
                          <StatusPill status={issue.status} />
                        </td>
                        <td>{new Date(issue.updatedAt).toLocaleDateString()}</td>
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
