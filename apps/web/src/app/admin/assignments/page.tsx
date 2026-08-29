"use client";

import { useState } from "react";
import { useQuery } from "convex/react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { ASSIGNMENT_STATUS_BY_ISSUE_STATUS } from "@/lib/admin-mappers";
import { CATEGORY_LABEL } from "@/lib/status";
import type { AssignmentStatus } from "@/lib/types";

import { api } from "@convex/_generated/api";
import { RoutePlanner } from "./RoutePlanner";

import styles from "../admin.module.css";

const COLUMNS: { key: AssignmentStatus; label: string }[] = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "pending_verification", label: "Pending verification" },
];

export default function AssignmentBoardPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "route">("kanban");
  const assignments = useQuery(api.assignments.listAll, {});

  const relevant = (assignments ?? [])
    .filter((a) => a.issue && ASSIGNMENT_STATUS_BY_ISSUE_STATUS[a.issue.status])
    .map((a) => ({ ...a, status: ASSIGNMENT_STATUS_BY_ISSUE_STATUS[a.issue!.status]! }));

  const activeRouteTasks = (assignments ?? [])
    .filter((a) => a.issue && (a.issue.status === "assigned" || a.issue.status === "in_progress"))
    .map((a) => ({
      assignmentId: a._id,
      workerId: a.workerId,
      workerName: a.workerName,
      issue: a.issue!,
      dueAt: a.dueAt,
    }));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <h1 className={styles.title}>Assignment board</h1>
            <p className={styles.subtitle}>Field-worker workload and intelligent route optimization.</p>
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
                {items.map((assignment) => (
                  <Card key={assignment._id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{assignment.issue!.trackingId}</strong>
                      <Badge tone="info">{CATEGORY_LABEL[assignment.issue!.category]}</Badge>
                    </div>
                    <p style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>{assignment.issue!.description}</p>
                    <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                      {assignment.workerName}
                      {assignment.dueAt ? ` · Due ${new Date(assignment.dueAt).toLocaleDateString()}` : ""}
                    </p>
                  </Card>
                ))}
                {items.length === 0 ? (
                  <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>Nothing here.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
