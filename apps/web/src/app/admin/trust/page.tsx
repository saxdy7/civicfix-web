"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Badge, Button, Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import styles from "../admin.module.css";

function FalseReportRow({ issue }: { issue: Doc<"issues"> }) {
  const reviewFalseReport = useMutation(api.issues.reviewFalseReport);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"confirmed_malicious" | "dismissed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecide = async (decision: "confirmed_malicious" | "dismissed") => {
    if (note.trim().length < 10) {
      setError("A documented reason (at least 10 characters) is required.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      await reviewFalseReport({ issueId: issue._id, decision, note: note.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this decision.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ marginBottom: "var(--space-3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div>
          <Link href={`/admin/queue/${issue._id}`} style={{ fontWeight: 700 }}>
            {issue.trackingId}
          </Link>
          <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-sm)" }}>{issue.description}</p>
        </div>
        <Badge tone="warning">Under review</Badge>
      </div>
      <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--font-size-sm)" }}>
        <strong>Field evidence reason:</strong> {issue.falseReportReason}
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Document your decision — this is required and permanently recorded."
        style={{
          width: "100%",
          minHeight: 70,
          margin: "var(--space-3) 0",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-control)",
          background: "var(--color-surface-muted)",
          color: "var(--color-foreground)",
          fontFamily: "inherit",
          fontSize: "var(--font-size-sm)",
          padding: "var(--space-3)",
          resize: "vertical",
        }}
      />
      {error ? (
        <p role="alert" className={styles.errorText} style={{ marginBottom: "var(--space-2)" }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button onClick={() => handleDecide("confirmed_malicious")} disabled={busy !== null}>
          {busy === "confirmed_malicious" ? "Saving…" : "Confirm malicious (−20 trust)"}
        </Button>
        <Button variant="secondary" onClick={() => handleDecide("dismissed")} disabled={busy !== null}>
          {busy === "dismissed" ? "Saving…" : "Dismiss — honest mistake"}
        </Button>
      </div>
    </Card>
  );
}

export default function TrustPage() {
  const queue = useQuery(api.issues.listFalseReportQueue, {});
  const trustScores = useQuery(api.users.listTrustScores, {});

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Trust &amp; false-report review</h1>
        <p className={styles.subtitle}>
          Only a confirmed malicious report affects a resident&apos;s trust score. After 3 confirmed reports,
          new-report creation is paused for 30 days with an appeal path.
        </p>
      </div>

      <h2 className={styles.sectionTitle}>Pending false-report review</h2>
      {queue === undefined ? (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      ) : queue.length === 0 ? (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <p className={styles.emptyState}>No reports currently flagged for review.</p>
        </Card>
      ) : (
        <div style={{ marginBottom: "var(--space-6)" }}>
          {queue.map((issue) => (
            <FalseReportRow key={issue._id} issue={issue} />
          ))}
        </div>
      )}

      <h2 className={styles.sectionTitle}>Trust-score ledger</h2>
      <Card>
        {trustScores === undefined ? (
          <p className={styles.emptyState}>Loading…</p>
        ) : trustScores.length === 0 ? (
          <p className={styles.emptyState}>No trust-score events yet — every resident starts at 100.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Trust score</th>
                  <th>Restricted until</th>
                  <th>Latest event</th>
                </tr>
              </thead>
              <tbody>
                {trustScores.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      {u.name} <span style={{ color: "var(--color-muted-foreground)" }}>({u.email})</span>
                    </td>
                    <td style={{ color: u.trustScore < 100 ? "var(--color-civic-red)" : undefined, fontWeight: u.trustScore < 100 ? 700 : 400 }}>
                      {u.trustScore}
                    </td>
                    <td>{u.restrictedUntil ? new Date(u.restrictedUntil).toLocaleDateString() : "—"}</td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                      {u.events[0] ? `${u.events[0].reason} (${new Date(u.events[0].createdAt).toLocaleDateString()})` : "—"}
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
