"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { ASSIGNMENT_STATUS_BY_ISSUE_STATUS } from "@/lib/admin-mappers";
import { CATEGORY_LABEL } from "@/lib/status";
import type { AssignmentStatus } from "@/lib/types";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { CompleteTaskModal } from "./CompleteTaskModal";
import { RoutePlanner } from "./RoutePlanner";

import styles from "../admin.module.css";

const COLUMNS: { key: AssignmentStatus; label: string }[] = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "pending_verification", label: "Pending verification" },
];

export default function AssignmentBoardPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "route">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeModalTask, setActiveModalTask] = useState<{
    issue: Doc<"issues">;
    assignmentId?: Id<"assignments">;
  } | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const assignments = useQuery(api.assignments.listAll, {});
  const updateStatus = useMutation(api.issues.updateStatus);

  const relevant = (assignments ?? [])
    .filter((a) => a.issue && ASSIGNMENT_STATUS_BY_ISSUE_STATUS[a.issue.status])
    .map((a) => ({ ...a, status: ASSIGNMENT_STATUS_BY_ISSUE_STATUS[a.issue!.status]! }))
    .filter((a) => {
      const matchesCategory = categoryFilter === "all" || a.issue!.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        a.issue!.trackingId.toLowerCase().includes(q) ||
        a.issue!.description.toLowerCase().includes(q) ||
        a.workerName.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

  const activeRouteTasks = (assignments ?? [])
    .filter((a) => a.issue && (a.issue.status === "assigned" || a.issue.status === "in_progress"))
    .map((a) => ({
      assignmentId: a._id,
      workerId: a.workerId,
      workerName: a.workerName,
      issue: a.issue!,
      dueAt: a.dueAt,
    }));

  const handleStartWork = async (issueId: Id<"issues">) => {
    setActionBusyId(issueId);
    try {
      await updateStatus({ issueId, nextStatus: "in_progress", note: "Worker started task." });
    } catch (err) {
      console.error("Failed to start work:", err);
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <h1 className={styles.title}>Assignment board</h1>
            <p className={styles.subtitle}>Field-worker workload, task execution, and intelligent route optimization.</p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button
              variant={viewMode === "kanban" ? "primary" : "secondary"}
              onClick={() => setViewMode("kanban")}
            >
              📋 Kanban Board
            </Button>
            <Button
              variant={viewMode === "route" ? "primary" : "secondary"}
              onClick={() => setViewMode("route")}
            >
              📍 Smart Route Planner ({activeRouteTasks.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="🔍 Search tracking ID, worker, or description…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid var(--color-border, #333)",
            background: "var(--color-surface, #18181b)",
            color: "var(--color-foreground, #fff)",
            fontSize: "0.875rem",
          }}
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid var(--color-border, #333)",
            background: "var(--color-surface, #18181b)",
            color: "var(--color-foreground, #fff)",
            fontSize: "0.875rem",
          }}
        >
          <option value="all">All Categories</option>
          <option value="pothole">Pothole</option>
          <option value="streetlight">Streetlight</option>
          <option value="garbage">Garbage & Waste</option>
          <option value="water">Water / Drainage</option>
          <option value="graffiti">Graffiti</option>
          <option value="other">Other</option>
        </select>
      </div>

      {assignments === undefined ? (
        <Card>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      ) : viewMode === "route" ? (
        <RoutePlanner tasks={activeRouteTasks} />
      ) : (
        <div className={styles.kanban}>
          {COLUMNS.map((column) => {
            const items = relevant.filter((a) => a.status === column.key);
            return (
              <div key={column.key} className={styles.kanbanColumn}>
                <p className={styles.kanbanColumnTitle}>
                  {column.label} ({items.length})
                </p>
                {items.map((assignment) => {
                  const issue = assignment.issue!;
                  const isAssigned = issue.status === "assigned";
                  const isInProgress = issue.status === "in_progress";
                  const isPendingVerif = issue.status === "pending_verification";
                  const isBusy = actionBusyId === issue._id;

                  return (
                    <Card key={assignment._id} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{issue.trackingId}</strong>
                        <Badge tone={isPendingVerif ? "success" : isInProgress ? "info" : "neutral"}>
                          {CATEGORY_LABEL[issue.category]}
                        </Badge>
                      </div>
                      <p style={{ margin: 0, fontSize: "var(--font-size-sm)", lineHeight: 1.4 }}>
                        {issue.description}
                      </p>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", display: "flex", justifyContent: "space-between" }}>
                        <span>👤 {assignment.workerName}</span>
                        {assignment.dueAt ? <span>Due {new Date(assignment.dueAt).toLocaleDateString()}</span> : null}
                      </div>

                      <div style={{ paddingTop: "6px", borderTop: "1px dashed var(--color-border, #333)", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {isAssigned ? (
                          <Button
                            variant="secondary"
                            onClick={() => handleStartWork(issue._id)}
                            disabled={isBusy}
                            style={{ flex: 1, fontSize: "12px", padding: "4px 8px" }}
                          >
                            {isBusy ? "Starting…" : "▶ Start Working"}
                          </Button>
                        ) : null}

                        {isAssigned || isInProgress ? (
                          <Button
                            variant="primary"
                            onClick={() => setActiveModalTask({ issue, assignmentId: assignment._id })}
                            disabled={isBusy}
                            style={{ flex: 1, fontSize: "12px", padding: "4px 8px" }}
                          >
                            📸 Complete & Submit Evidence
                          </Button>
                        ) : null}

                        {isPendingVerif ? (
                          <Link href="/admin/community" style={{ width: "100%" }}>
                            <Button
                              variant="secondary"
                              style={{ width: "100%", fontSize: "12px", padding: "4px 8px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid #10b981" }}
                            >
                              🗳️ View in Community Votes →
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
                {items.length === 0 ? (
                  <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>Nothing here.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {activeModalTask ? (
        <CompleteTaskModal
          issue={activeModalTask.issue}
          assignmentId={activeModalTask.assignmentId}
          onClose={() => setActiveModalTask(null)}
        />
      ) : null}
    </div>
  );
}
