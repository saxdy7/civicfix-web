"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { ALLOWED_NEXT_STATUS } from "@/lib/admin-mappers";
import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

import styles from "../../admin.module.css";

export function TriagePanel({ issue }: { issue: Doc<"issues"> }) {
  const departments = useQuery(api.departments.list, {});
  const workers = useQuery(api.users.listFieldWorkers, {});
  const assignment = useQuery(api.assignments.getByIssue, { issueId: issue._id });
  const similarIssues = useQuery(
    api.issues.findNearbySimilar,
    issue.duplicateOfIssueId
      ? "skip"
      : { latitude: issue.latitude, longitude: issue.longitude, category: issue.category, radiusM: 200, excludeIssueId: issue._id },
  );
  const duplicateTarget = useQuery(
    api.issues.getById,
    issue.duplicateOfIssueId ? { issueId: issue.duplicateOfIssueId } : "skip",
  );
  const aiAssessment = useQuery(api.aiAssessments.latestForIssue, { issueId: issue._id });

  const routeToDepartment = useMutation(api.issues.routeToDepartment);
  const markDuplicate = useMutation(api.issues.markDuplicate);
  const assignWorker = useMutation(api.assignments.assignWorker);

  const canMarkDuplicate = ALLOWED_NEXT_STATUS[issue.status]?.includes("duplicate") ?? false;

  const [dupTrackingId, setDupTrackingId] = useState("");
  const [dupBusy, setDupBusy] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);

  const [userSelectedDeptId, setUserSelectedDeptId] = useState<Id<"departments"> | null>(null);
  const departmentId = userSelectedDeptId ?? issue.departmentId ?? "";
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSaved, setAssignSaved] = useState<string | null>(null);

  const [userSelectedWorkerId, setUserSelectedWorkerId] = useState<Id<"users"> | null>(null);
  const workerId = userSelectedWorkerId ?? assignment?.workerId ?? "";
  const [workerBusy, setWorkerBusy] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [workerSaved, setWorkerSaved] = useState<string | null>(null);

  async function handleAssignWorker() {
    if (!workerId) {
      setWorkerError("Choose a field worker first.");
      return;
    }
    setWorkerBusy(true);
    setWorkerError(null);
    setWorkerSaved(null);
    try {
      await assignWorker({ issueId: issue._id, workerId });
      setWorkerSaved("Assigned.");
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : "Could not assign this worker.");
    } finally {
      setWorkerBusy(false);
    }
  }

  async function handleMarkDuplicate() {
    const trackingId = dupTrackingId.trim().toUpperCase();
    if (!trackingId) {
      setDupError("Enter the tracking ID this report duplicates.");
      return;
    }
    setDupBusy(true);
    setDupError(null);
    try {
      await markDuplicate({ issueId: issue._id, duplicateOfTrackingId: trackingId });
    } catch (err) {
      setDupError(err instanceof Error ? err.message : "Could not mark this report as a duplicate.");
    } finally {
      setDupBusy(false);
    }
  }

  async function handleRouteToDepartment() {
    if (!departmentId) {
      setAssignError("Choose a department first.");
      return;
    }
    setAssignBusy(true);
    setAssignError(null);
    setAssignSaved(null);
    try {
      await routeToDepartment({ issueId: issue._id, departmentId });
      setAssignSaved("Routed to department.");
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
            Suggested category: <strong>{CATEGORY_LABEL[(aiAssessment.output as { category: string }).category as keyof typeof CATEGORY_LABEL]}</strong>{" "}
            <Badge tone="info">{Math.round((aiAssessment.confidence ?? 0) * 100)}% confidence</Badge>
          </p>
          <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
            AI-assisted — always reviewed by staff before it affects routing.
          </p>
        </Card>
      ) : (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <h2 className={styles.sectionTitle}>AI-assisted suggestion</h2>
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            No AI assessment on file — this report was likely filed without using the AI-assist step.
          </p>
        </Card>
      )}

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 className={styles.sectionTitle}>Duplicate</h2>
        {duplicateTarget ? (
          <p style={{ margin: 0 }}>
            Linked as a duplicate of <strong>{duplicateTarget.trackingId}</strong> — {duplicateTarget.description}
          </p>
        ) : canMarkDuplicate ? (
          <>
            {(similarIssues ?? []).length > 0 ? (
              <div style={{ marginBottom: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
                  Nearby reports of the same category — possible duplicates:
                </p>
                {(similarIssues ?? []).map((s) => (
                  <div
                    key={s._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-2)",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-control)",
                      background: "var(--color-surface-muted)",
                    }}
                  >
                    <span style={{ fontSize: "var(--font-size-sm)" }}>
                      <strong>{s.trackingId}</strong> · {STATUS_SHORT_LABEL[s.status]} — {s.description.slice(0, 60)}
                      {s.description.length > 60 ? "…" : ""}
                    </span>
                    <Button variant="secondary" onClick={() => setDupTrackingId(s.trackingId)} disabled={dupBusy}>
                      Use this
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
                No nearby similar reports found. If you still recognize this as a repeat, link it manually by
                tracking ID.
              </p>
            )}
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
              <Button variant="secondary" onClick={handleMarkDuplicate} disabled={dupBusy}>
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
            onChange={(e) => setUserSelectedDeptId((e.target.value as Id<"departments">) || null)}
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
            {(departments ?? []).map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button onClick={handleRouteToDepartment} disabled={assignBusy}>
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
        {(workers ?? []).length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            No field workers exist yet — approve a field-worker access request first.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={workerId}
                onChange={(e) => setUserSelectedWorkerId((e.target.value as Id<"users">) || null)}
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
                {(workers ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <Button onClick={handleAssignWorker} disabled={workerBusy}>
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
