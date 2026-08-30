"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

interface SubmittedReportActionsProps {
  issueId?: string;
  trackingId?: string;
}

export function SubmittedReportActions({ issueId, trackingId }: SubmittedReportActionsProps) {
  const router = useRouter();
  const deleteIssue = useMutation(api.issues.deleteIssue);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!issueId) return;
    setDeleting(true);
    try {
      await deleteIssue({
        issueId: issueId as Id<"issues">,
        reason: "Deleted by resident immediately after submission",
      });
      router.push("/app/reports");
    } catch (err) {
      alert("Error deleting report: " + (err instanceof Error ? err.message : String(err)));
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", width: "100%" }}>
      {showConfirm && (
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            textAlign: "left",
          }}
        >
          <strong style={{ color: "var(--color-civic-red)" }}>⚠️ Delete this report?</strong>
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-foreground)" }}>
            Are you sure you want to delete report <strong>{trackingId ?? "this report"}</strong>? It will be removed immediately.
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              style={{
                background: "var(--color-civic-red)",
                color: "#ffffff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "var(--radius-control)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {deleting ? "Deleting…" : "Yes, Delete Report"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setShowConfirm(false)}
              style={{
                background: "var(--color-surface)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
                padding: "8px 16px",
                borderRadius: "var(--radius-control)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", justifyContent: "center" }}>
        {issueId ? (
          <Link
            href={`/app/reports/${issueId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 var(--space-5)",
              borderRadius: "var(--radius-pill)",
              background: "var(--color-inverse-background)",
              color: "var(--color-inverse-foreground)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
            }}
          >
            View report details
          </Link>
        ) : (
          <Link
            href="/app/reports"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 var(--space-5)",
              borderRadius: "var(--radius-pill)",
              background: "var(--color-inverse-background)",
              color: "var(--color-inverse-foreground)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
            }}
          >
            View my reports
          </Link>
        )}

        <Link
          href="/app/report"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 44,
            padding: "0 var(--space-5)",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "var(--font-size-sm)",
          }}
        >
          Report another issue
        </Link>

        {issueId && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 var(--space-4)",
              borderRadius: "var(--radius-pill)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "rgba(239, 68, 68, 0.08)",
              color: "var(--color-civic-red)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
            }}
          >
            🗑️ Delete post
          </button>
        )}
      </div>
    </div>
  );
}
