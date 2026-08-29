"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { ALLOWED_NEXT_STATUS } from "@/lib/admin-mappers";
import { STATUS_SHORT_LABEL } from "@/lib/status";
import type { IssueSeverity, IssueStatus } from "@/lib/types";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import styles from "../../admin.module.css";

const SEVERITIES: IssueSeverity[] = ["low", "medium", "high", "critical"];

export function ResolutionPanel({ issue }: { issue: Doc<"issues"> }) {
  const assignment = useQuery(api.assignments.getByIssue, { issueId: issue._id });
  const evidence = useQuery(api.resolutionEvidence.latestForIssue, { issueId: issue._id });
  const updateStatus = useMutation(api.issues.updateStatus);

  const [severity, setSeverity] = useState<IssueSeverity>(issue.severity);
  const [nextStatus, setNextStatus] = useState<IssueStatus | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = ALLOWED_NEXT_STATUS[issue.status] ?? [];
  const needsEvidence = nextStatus === "resolved";
  const needsReason = nextStatus === "rejected" || nextStatus === "reopened";
  const hasVerifiedEvidence = Boolean(evidence?.verifiedAt);

  async function handleSave() {
    if (!nextStatus && severity === issue.severity) {
      setError("Choose a transition or change the severity before saving.");
      return;
    }
    if (needsReason && note.trim().length < 10) {
      setError("A reason is required when rejecting or reopening an issue.");
      return;
    }
    if (needsEvidence && !hasVerifiedEvidence) {
      setError("This issue has no verified resolution evidence on file. Evidence must be verified before it can be resolved.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await updateStatus({
        issueId: issue._id,
        nextStatus: nextStatus || undefined,
        severity: severity !== issue.severity ? severity : undefined,
        note: note.trim() || undefined,
      });

      const parts = [
        nextStatus ? `Status set to ${STATUS_SHORT_LABEL[nextStatus]}.` : null,
        severity !== issue.severity ? `Severity set to ${severity}.` : null,
      ];
      setSaved(parts.filter(Boolean).join(" ") || "Saved.");
      setNextStatus("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this decision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className={styles.sectionTitle}>Triage &amp; resolution record</h2>
      <p
        style={{
          margin: "0 0 var(--space-4)",
          fontSize: "var(--font-size-sm)",
          color: "var(--color-muted-foreground)",
          lineHeight: 1.6,
        }}
      >
        Severity and status changes go through an audited, transition-checked Convex mutation —
        never a direct database write.
      </p>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <span className={styles.sectionTitle} style={{ fontSize: "var(--font-size-sm)" }}>
          Confirmed severity
        </span>
        <div className={styles.toolbar} style={{ marginBottom: 0 }}>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.chip} ${severity === s ? styles.chipActive : ""}`}
              onClick={() => setSeverity(s)}
              aria-pressed={severity === s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <span className={styles.sectionTitle} style={{ fontSize: "var(--font-size-sm)" }}>
          Move to
        </span>
        {allowed.length === 0 ? (
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
            <Badge tone="neutral">{STATUS_SHORT_LABEL[issue.status]}</Badge> is a terminal state —
            no further transitions are permitted.
          </p>
        ) : (
          <div className={styles.toolbar} style={{ marginBottom: 0 }}>
            {allowed.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.chip} ${nextStatus === s ? styles.chipActive : ""}`}
                onClick={() => setNextStatus(s)}
                aria-pressed={nextStatus === s}
              >
                {STATUS_SHORT_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        {needsEvidence && !hasVerifiedEvidence ? (
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-civic-amber)", marginTop: "var(--space-2)" }}>
            No verified resolution evidence is on file for this issue yet.
          </p>
        ) : null}
      </div>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Field assignment</span>
        <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
          {assignment?.workerName
            ? `${assignment.workerName}${assignment.dueAt ? ` · due ${new Date(assignment.dueAt).toLocaleDateString()}` : ""}`
            : "No assignment on file yet."}
        </p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
          Staff note {needsReason ? "(required)" : "(optional — recorded on the status change)"}
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={needsReason ? "Explain why this is being rejected or reopened." : "Anything the next person handling this should know."}
          style={{ ...selectStyle, minHeight: 96, resize: "vertical", lineHeight: 1.6 }}
        />
      </label>

      {error ? (
        <p role="alert" className={styles.errorText} style={{ marginBottom: "var(--space-3)" }}>
          {error}
        </p>
      ) : null}

      {saved ? (
        <p role="status" style={{ color: "var(--color-civic-green)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-3)" }}>
          {saved}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button onClick={handleSave} disabled={busy}>
          {busy ? "Saving…" : "Record decision"}
        </Button>
        <Button variant="secondary" onClick={() => setNextStatus("")} disabled={busy}>
          Reset
        </Button>
      </div>
    </Card>
  );
}

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  background: "var(--color-surface-muted)",
  color: "var(--color-foreground)",
  fontFamily: "inherit",
  fontSize: "var(--font-size-sm)",
  padding: "var(--space-3) var(--space-4)",
};
