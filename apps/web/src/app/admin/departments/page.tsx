"use client";

import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { isOverdue } from "@/lib/admin-mappers";
import { CATEGORY_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";

import styles from "../admin.module.css";

export default function DepartmentsPage() {
  const departments = useQuery(api.departments.list, {});
  const issues = useQuery(api.issues.list, {});

  const rows = (departments ?? []).map((dept) => {
    const deptIssues = (issues ?? []).filter((i) => i.departmentId === dept._id);
    const open = deptIssues.filter((i) => !["resolved", "rejected", "duplicate"].includes(i.status));
    const overdue = open.filter((i) => isOverdue(i.createdAt, dept.slaHours, i.status));
    return { ...dept, openCount: open.length, overdueCount: overdue.length };
  });

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Departments &amp; SLA</h1>
        <p className={styles.subtitle}>Coverage and service-level targets by department.</p>
      </div>

      <Card>
        {departments === undefined ? (
          <p className={styles.emptyState}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className={styles.emptyState}>No departments configured yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Categories</th>
                  <th>SLA target</th>
                  <th>Open issues</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((dept) => (
                  <tr key={dept._id}>
                    <td>{dept.name}</td>
                    <td>{dept.categories.map((c) => CATEGORY_LABEL[c]).join(", ") || "—"}</td>
                    <td>{dept.slaHours}h</td>
                    <td>{dept.openCount}</td>
                    <td
                      style={{
                        color: dept.overdueCount > 0 ? "var(--color-civic-red)" : undefined,
                        fontWeight: dept.overdueCount > 0 ? 700 : 400,
                      }}
                    >
                      {dept.overdueCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
