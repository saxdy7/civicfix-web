"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { Button, Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { isOverdue } from "@/lib/admin-mappers";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import styles from "../admin.module.css";

export default function IssueQueuePage() {
  const issues = useQuery(api.issues.list, {});
  const departments = useQuery(api.departments.list, {});
  const workers = useQuery(api.users.listFieldWorkers, {});

  const assignWorker = useMutation(api.assignments.assignWorker);
  const routeToDepartment = useMutation(api.issues.routeToDepartment);

  const [assigningId, setAssigningId] = useState<string | null>(null);

  const deptById = new Map((departments ?? []).map((d) => [d._id, d]));
  const sorted = [...(issues ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  const handleQuickAssign = async (issueId: Id<"issues">) => {
    setAssigningId(issueId);
    try {
      // Find first department or Public Works department
      const publicWorksDept = (departments ?? []).find((d) => d.name.toLowerCase().includes("public works")) ?? departments?.[0];
      if (publicWorksDept) {
        try {
          await routeToDepartment({ issueId, departmentId: publicWorksDept._id });
        } catch {
          // Ignore if already routed
        }
      }

      // Assign to first field worker (Alex Worker)
      const worker = workers?.[0];
      if (worker) {
        await assignWorker({ issueId, workerId: worker.id as Id<"users"> });
      }
    } catch (err) {
      console.error("Failed to quick assign:", err);
    } finally {
      setAssigningId(null);
    }
  };

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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((issue) => {
                  const dept = issue.departmentId ? deptById.get(issue.departmentId) : null;
                  const overdue = isOverdue(issue.createdAt, dept?.slaHours ?? 72, issue.status);
                  const isUnassigned = issue.status === "reported" || issue.status === "triaged";
                  const isBusy = assigningId === issue._id;

                  return (
                    <tr key={issue._id} style={overdue ? { background: "var(--color-civic-red-soft)" } : undefined}>
                      <td>
                        <Link href={`/admin/queue/${issue._id}`}>
                          <strong>{issue.trackingId}</strong>
                        </Link>
                      </td>
                      <td>{CATEGORY_LABEL[issue.category]}</td>
                      <td>{SEVERITY_LABEL[issue.severity]}</td>
                      <td>{dept?.name ?? "Unassigned"}</td>
                      <td>
                        <StatusPill status={issue.status} />
                      </td>
                      <td>{new Date(issue.createdAt).toLocaleDateString()}</td>
                      <td>
                        {isUnassigned ? (
                          <Button
                            variant="primary"
                            onClick={() => handleQuickAssign(issue._id)}
                            disabled={isBusy || (workers ?? []).length === 0}
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                          >
                            {isBusy ? "Assigning…" : "⚡ Assign Worker"}
                          </Button>
                        ) : (
                          <Link href={`/admin/queue/${issue._id}`}>
                            <span style={{ fontSize: "12px", color: "var(--color-civic-green)" }}>Details →</span>
                          </Link>
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
