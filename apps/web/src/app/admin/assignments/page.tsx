import { Badge, Card } from "@civicfix/ui-web";

import { ASSIGNMENT_STATUS_BY_ISSUE_STATUS } from "@/lib/admin-mappers";
import { createServerSupabase } from "@/lib/supabase-server";
import { CATEGORY_LABEL } from "@/lib/status";
import type { Assignment, AssignmentStatus, IssueCategory, IssueStatus } from "@/lib/types";

import styles from "../admin.module.css";

const COLUMNS: { key: AssignmentStatus; label: string }[] = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "pending_verification", label: "Pending verification" },
];

interface AssignmentRow {
  id: string;
  issue_id: string;
  worker_id: string | null;
  due_at: string | null;
  issues: {
    tracking_id: string;
    category: IssueCategory;
    description: string;
    status: IssueStatus;
  } | null;
}

async function loadAssignments(): Promise<Assignment[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("assignments")
    .select("id, issue_id, worker_id, due_at, issues(tracking_id, category, description, status)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as AssignmentRow[];
  const relevant = rows.filter((row) => row.issues && ASSIGNMENT_STATUS_BY_ISSUE_STATUS[row.issues.status]);

  const workerIds = Array.from(new Set(relevant.map((r) => r.worker_id).filter((id): id is string => !!id)));
  const workerNames = new Map<string, string>();
  if (workerIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", workerIds);
    (profiles ?? []).forEach((p) => {
      if (p.full_name) workerNames.set(p.id, p.full_name);
    });
  }

  return relevant.map((row) => ({
    id: row.id,
    issueId: row.issue_id,
    issueTrackingId: row.issues!.tracking_id,
    issueSummary: row.issues!.description,
    category: row.issues!.category,
    worker: row.worker_id ? (workerNames.get(row.worker_id) ?? "Unnamed worker") : "Unassigned",
    status: ASSIGNMENT_STATUS_BY_ISSUE_STATUS[row.issues!.status]!,
    dueAt: row.due_at ?? "",
  }));
}

export default async function AssignmentBoardPage() {
  const assignments = await loadAssignments();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Assignment board</h1>
        <p className={styles.subtitle}>Field-worker workload across the resolution pipeline.</p>
      </div>

      {assignments === null ? (
        <Card>
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to see live assignments here.
          </p>
        </Card>
      ) : (
        <div className={styles.kanban}>
          {COLUMNS.map((column) => {
            const items = assignments.filter((a) => a.status === column.key);
            return (
              <div key={column.key} className={styles.kanbanColumn}>
                <p className={styles.kanbanColumnTitle}>
                  {column.label} ({items.length})
                </p>
                {items.map((assignment) => (
                  <Card key={assignment.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{assignment.issueTrackingId}</strong>
                      <Badge tone="info">{CATEGORY_LABEL[assignment.category]}</Badge>
                    </div>
                    <p style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>{assignment.issueSummary}</p>
                    <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                      {assignment.worker}
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
