"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { ALLOWED_NEXT_STATUS } from "@/lib/admin-mappers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { CATEGORY_LABEL } from "@/lib/status";
import type { Issue, IssueCategory } from "@/lib/types";

import styles from "../../admin.module.css";

interface DepartmentOption {
  id: string;
  name: string;
}

interface DuplicateIssue {
  id: string;
  trackingId: string;
  description: string;
}

interface AiAssessment {
  category: IssueCategory;
  confidence: number;
}

interface WorkerOption {
  id: string;
  name: string;
}

export function TriagePanel({
  issue,
  duplicateIssue,
  aiAssessment,
  departments,
  workers,
  assignedWorkerId,
}: {
  issue: Issue;
  duplicateIssue: DuplicateIssue | null;
  aiAssessment: AiAssessment | null;
  departments: DepartmentOption[];
  workers: WorkerOption[];
  assignedWorkerId: string | null;
}) {
  const router = useRouter();
  const canMarkDuplicate = ALLOWED_NEXT_STATUS[issue.status]?.includes("duplicate") ?? false;

  const [dupTrackingId, setDupTrackingId] = useState("");
  const [dupBusy, setDupBusy] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);

  const [departmentId, setDepartmentId] = useState<string>(
    departments.find((d) => d.name === issue.department)?.id ?? "",
  );
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSaved, setAssignSaved] = useState<string | null>(null);

  const [workerId, setWorkerId] = useState<string>(assignedWorkerId ?? "");
  const [workerBusy, setWorkerBusy] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [workerSaved, setWorkerSaved] = useState<string | null>(null);

  async function handleAssignWorker() {
    if (!supabase) return;
    if (!workerId) {
      setWorkerError("Choose a field worker first.");
      return;
    }
    setWorkerBusy(true);
    setWorkerError(null);
    setWorkerSaved(null);
    try {
      const { error } = await supabase.rpc("assign_worker", {
        p_issue_id: issue.id,
        p_worker_id: workerId,
      });
      if (error) throw error;
      setWorkerSaved("Assigned.");
      router.refresh();
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : "Could not assign this worker.");
    } finally {
      setWorkerBusy(false);
    }
  }

  async function handleMarkDuplicate() {
    if (!supabase) return;
    const trackingId = dupTrackingId.trim().toUpperCase();
    if (!trackingId) {
      setDupError("Enter the tracking ID this report duplicates.");
      return;
    }
    setDupBusy(true);
    setDupError(null);
    try {
      const { data: target, error: findError } = await supabase
        .from("issues")
        .select("id")
        .eq("tracking_id", trackingId)
        .maybeSingle();

      if (findError) throw findError;
      if (!target) {
        setDupError(`No report found with tracking ID ${trackingId}.`);
        return;
      }
      if (target.id === issue.id) {
        setDupError("A report cannot be marked as a duplicate of itself.");
        return;
      }

      const { error: updateError } = await supabase
        .from("issues")
        .update({ status: "duplicate", duplicate_of_issue_id: target.id, updated_at: new Date().toISOString() })
        .eq("id", issue.id);

      if (updateError) throw updateError;
      router.refresh();
    } catch (err) {
      setDupError(err instanceof Error ? err.message : "Could not mark this report as a duplicate.");
    } finally {
      setDupBusy(false);
    }
  }

  async function handleRouteToDepartment() {
    if (!supabase) return;
    if (!departmentId) {
      setAssignError("Choose a department first.");
      return;
    }
    setAssignBusy(true);
    setAssignError(null);
    setAssignSaved(null);
    try {
      const update: Record<string, unknown> = {
        department_id: departmentId,
        updated_at: new Date().toISOString(),
      };
      if (issue.status === "triaged") update.status = "assigned";

      const { error } = await supabase.from("issues").update(update).eq("id", issue.id);
      if (error) throw error;

      setAssignSaved("Routed to department.");
      router.refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not route this report.");
    } finally {
      setAssignBusy(false);
    }
  }

  return (
    <>
      {aiAssessment ? (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <h2 className={styles.sectionTitle}>AI-assisted suggestion</h2>
          <p style={{ margin: 0 }}>
            Suggested category: <strong>{CATEGORY_LABEL[aiAssessment.category]}</strong>{" "}
            <Badge tone="info">{Math.round(aiAssessment.confidence * 100)}% confidence</Badge>
          </p>
          <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
            AI-assisted — always reviewed by staff before it affects routing.
          </p>
        </Card>
      ) : (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <h2 className={styles.sectionTitle}>AI-assisted suggestion</h2>
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            Not available yet — the AI analysis job that would populate this hasn&apos;t been built.
          </p>
        </Card>
      )}

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 className={styles.sectionTitle}>Duplicate</h2>
        {duplicateIssue ? (
          <p style={{ margin: 0 }}>
            Linked as a duplicate of <strong>{duplicateIssue.trackingId}</strong> — {duplicateIssue.description}
          </p>
        ) : canMarkDuplicate ? (
          <>
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
              There is no automated duplicate detection yet — if you recognize this as a repeat of another
              report, link it manually by tracking ID.
            </p>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <input
                value={dupTrackingId}
                onChange={(e) => setDupTrackingId(e.target.value)}
                placeholder="e.g. CF-10250"
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-control)",
                  background: "var(--color-surface-muted)",
                  color: "var(--color-foreground)",
                  fontFamily: "inherit",
                  fontSize: "var(--font-size-sm)",
                  padding: "var(--space-3) var(--space-4)",
                }}
              />
              <Button variant="secondary" onClick={handleMarkDuplicate} disabled={dupBusy || !isSupabaseConfigured}>
                {dupBusy ? "Linking…" : "Mark as duplicate"}
              </Button>
            </div>
            {dupError ? (
              <p role="alert" style={{ color: "var(--color-civic-red)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-2)" }}>
                {dupError}
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            Not linked to another report.
          </p>
        )}
      </Card>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 className={styles.sectionTitle}>Route to department</h2>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-control)",
              background: "var(--color-surface-muted)",
              color: "var(--color-foreground)",
              fontFamily: "inherit",
              fontSize: "var(--font-size-sm)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            <option value="">Unassigned</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button onClick={handleRouteToDepartment} disabled={assignBusy || !isSupabaseConfigured}>
            {assignBusy ? "Routing…" : "Route to department"}
          </Button>
        </div>
        {assignError ? (
          <p role="alert" style={{ color: "var(--color-civic-red)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-2)" }}>
            {assignError}
          </p>
        ) : null}
        {assignSaved ? (
          <p role="status" style={{ color: "var(--color-civic-green)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-2)" }}>
            {assignSaved}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Assign a field worker</h2>
        {workers.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            No field workers exist yet — approve a field-worker access request first.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-control)",
                  background: "var(--color-surface-muted)",
                  color: "var(--color-foreground)",
                  fontFamily: "inherit",
                  fontSize: "var(--font-size-sm)",
                  padding: "var(--space-3) var(--space-4)",
                }}
              >
                <option value="">Choose a worker</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <Button onClick={handleAssignWorker} disabled={workerBusy || !isSupabaseConfigured}>
                {workerBusy ? "Assigning…" : "Assign"}
              </Button>
            </div>
            {workerError ? (
              <p role="alert" style={{ color: "var(--color-civic-red)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-2)" }}>
                {workerError}
              </p>
            ) : null}
            {workerSaved ? (
              <p role="status" style={{ color: "var(--color-civic-green)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-2)" }}>
                {workerSaved}
              </p>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
