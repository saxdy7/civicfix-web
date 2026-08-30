"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useState } from "react";

import { Button, Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { isOverdue } from "@/lib/admin-mappers";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

import styles from "../admin.module.css";
import { CompleteTaskModal } from "../assignments/CompleteTaskModal";
import { CancelIssueModal } from "./CancelIssueModal";
import { IssueDetailModal } from "./IssueDetailModal";
import { TakeTaskModal } from "./TakeTaskModal";

export default function IssueQueuePage() {
  const issues = useQuery(api.issues.list, {});
  const departments = useQuery(api.departments.list, {});

  const [detailIssueId, setDetailIssueId] = useState<Id<"issues"> | null>(null);
  const [takeTaskIssue, setTakeTaskIssue] = useState<Doc<"issues"> | null>(null);
  const [completeIssue, setCompleteIssue] = useState<Doc<"issues"> | null>(null);
  const [cancelIssue, setCancelIssue] = useState<Doc<"issues"> | null>(null);

  const deptById = new Map((departments ?? []).map((d) => [d._id, d]));
  const sorted = [...(issues ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Issue queue</h1>
        <p className={styles.subtitle}>Triage incoming reports, review citizen problem details, and dispatch work tasks.</p>
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
                  const canComplete = issue.status === "assigned" || issue.status === "in_progress" || issue.status === "pending_verification";
                  const canCancel = issue.status !== "resolved" && issue.status !== "rejected";

                  return (
                    <tr key={issue._id} style={overdue ? { background: "var(--color-civic-red-soft)" } : undefined}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setDetailIssueId(issue._id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "inherit",
                            fontWeight: 700,
                            cursor: "pointer",
                            textAlign: "left",
                            textDecoration: "underline",
                          }}
                        >
                          {issue.trackingId}
                        </button>
                      </td>
                      <td>{CATEGORY_LABEL[issue.category]}</td>
                      <td>{SEVERITY_LABEL[issue.severity]}</td>
                      <td>{dept?.name ?? "Unassigned"}</td>
                      <td>
                        <StatusPill status={issue.status} />
                      </td>
                      <td>{new Date(issue.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "nowrap" }}>
                          {/* 1. Take the task button */}
                          {isUnassigned ? (
                            <Button
                              variant="primary"
                              onClick={() => setTakeTaskIssue(issue)}
                              style={{ fontSize: "11px", padding: "4px 10px", whiteSpace: "nowrap" }}
                            >
                              ⚡ Take the Task
                            </Button>
                          ) : canComplete ? (
                            <button
                              type="button"
                              onClick={() => setCompleteIssue(issue)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 10px",
                                borderRadius: "var(--radius-control)",
                                border: "1px solid var(--color-civic-green, #10b981)",
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "var(--color-civic-green, #10b981)",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ✅ Mark Completion
                            </button>
                          ) : null}

                          {/* 2. View details button */}
                          <button
                            type="button"
                            onClick={() => setDetailIssueId(issue._id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 10px",
                              borderRadius: "var(--radius-control)",
                              border: "1px solid var(--color-border)",
                              background: "var(--color-surface-muted)",
                              color: "var(--color-foreground)",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            👁️ View Details
                          </button>

                          {/* 3. Cancel / Reject button */}
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => setCancelIssue(issue)}
                              title="Cancel or reject fake/invalid report"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 8px",
                                borderRadius: "var(--radius-control)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                background: "rgba(239, 68, 68, 0.08)",
                                color: "var(--color-civic-red, #ef4444)",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              🚫 Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 1. Citizen Problem Details Modal (Only Problem, Photo, Location, Description) */}
      {detailIssueId && (
        <IssueDetailModal
          issueId={detailIssueId}
          onClose={() => setDetailIssueId(null)}
          onTakeTask={(id) => {
            const found = (issues ?? []).find((i) => i._id === id);
            if (found) setTakeTaskIssue(found);
          }}
          onCancelIssue={(iss) => setCancelIssue(iss)}
        />
      )}

      {/* 2. Take Task & Dispatch Modal */}
      {takeTaskIssue && (
        <TakeTaskModal
          issue={takeTaskIssue}
          onClose={() => setTakeTaskIssue(null)}
        />
      )}

      {/* 3. Mark Completion & Verification Modal */}
      {completeIssue && (
        <CompleteTaskModal
          issue={completeIssue}
          onClose={() => setCompleteIssue(null)}
        />
      )}

      {/* 4. Cancel / Reject Issue Modal */}
      {cancelIssue && (
        <CancelIssueModal
          issue={cancelIssue}
          onClose={() => setCancelIssue(null)}
        />
      )}
    </div>
  );
}

