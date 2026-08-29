"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { isOverdue } from "@/lib/admin-mappers";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";

import styles from "../admin.module.css";

export default function IssueQueuePage() {
  const issues = useQuery(api.issues.list, {});
  const departments = useQuery(api.departments.list, {});
  const deptById = new Map((departments ?? []).map((d) => [d._id, d]));
  const sorted = [...(issues ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Issue queue</h1>
        <p className={styles.subtitle}>Triage incoming reports, review AI suggestions, and route to a department.</p>
      </div>

      <Card>
        {issues === undefined ? (
          <p className={styles.emptyState}>Loading…</p>
        ) : sorted.length === 0 ? (
          <p className={styles.emptyState}>No reports yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((issue) => {
                  const dept = issue.departmentId ? deptById.get(issue.departmentId) : null;
                  const overdue = isOverdue(issue.createdAt, dept?.slaHours ?? 72, issue.status);
                  return (
                    <tr key={issue._id} style={overdue ? { background: "var(--color-civic-red-soft)" } : undefined}>
                      <td>
                        <Link href={`/admin/queue/${issue._id}`}>{issue.trackingId}</Link>
                      </td>
                      <td>{CATEGORY_LABEL[issue.category]}</td>
                      <td>{SEVERITY_LABEL[issue.severity]}</td>
                      <td>{dept?.name ?? "Unassigned"}</td>
                      <td>
                        <StatusPill status={issue.status} />
                      </td>
                      <td>{new Date(issue.createdAt).toLocaleDateString()}</td>
                      <td>
                        {overdue ? (
                          <span style={{ color: "var(--color-civic-red)", fontWeight: 700 }}>⚠ Overdue</span>
                        ) : (
                          <span style={{ color: "var(--color-muted-foreground)" }}>On track</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
