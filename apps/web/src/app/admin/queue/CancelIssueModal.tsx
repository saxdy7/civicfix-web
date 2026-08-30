"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Button } from "@civicfix/ui-web";

import { CATEGORY_LABEL } from "@/lib/status";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

interface CancelIssueModalProps {
  issue: Doc<"issues">;
  onClose: () => void;
  onSuccess?: () => void;
}

const CANCEL_REASONS = [
  { label: "🚫 Fake / Malicious / Spam Report", isFake: true, defaultNote: "Identified as a false or invalid report during administrative review." },
  { label: "🏢 Not City Jurisdiction (Private property / State highway)", isFake: false, defaultNote: "Located on private property or state highway outside city municipal maintenance scope." },
  { label: "❓ Unclear / Inactionable Information", isFake: false, defaultNote: "Insufficient or garbled report details to locate or service the issue." },
  { label: "✨ Already Resolved / No Defect Found On-Site", isFake: false, defaultNote: "City inspection verified the issue is already cleared or resolved." },
  { label: "✏️ Custom Reason…", isFake: false, defaultNote: "" },
];

export function CancelIssueModal({ issue, onClose, onSuccess }: CancelIssueModalProps) {
  const updateStatus = useMutation(api.issues.updateStatus);

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [customReason, setCustomReason] = useState<string>(CANCEL_REASONS[0].defaultNote);
  const [isFake, setIsFake] = useState<boolean>(CANCEL_REASONS[0].isFake);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectReason = (idx: number) => {
    setSelectedIdx(idx);
    const chosen = CANCEL_REASONS[idx];
    setIsFake(chosen.isFake);
    setCustomReason(chosen.defaultNote);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const reasonText = customReason.trim();
    if (!reasonText) {
      setError("Please provide a cancellation reason.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const fullNote = isFake
        ? `Report cancelled as fake/invalid: ${reasonText}`
        : `Report cancelled: ${reasonText}`;

      // Guarantee minimum 10 characters requirement for rejected status
      const validNote = fullNote.length >= 10 ? fullNote : `${fullNote} (administrative review)`;

      await updateStatus({
        issueId: issue._id,
        nextStatus: "rejected",
        note: validNote,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "var(--radius-lg, 12px)",
          maxWidth: "520px",
          width: "100%",
          padding: "var(--space-5)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          color: "var(--color-foreground, #0f172a)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--color-civic-red, #ef4444)" }}>
            🚫 Cancel / Reject Report: {issue.trackingId}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-muted-foreground, #64748b)",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "2px 8px",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-sm, 14px)", color: "var(--color-muted-foreground, #475569)", lineHeight: 1.5 }}>
          Rejecting or cancelling report for <strong style={{ color: "var(--color-foreground, #0f172a)" }}>{CATEGORY_LABEL[issue.category]}</strong>. The citizen will be notified and this report will be closed.
        </p>

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-xs, 13px)", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
              Select Cancellation Reason:
            </label>
            <select
              value={selectedIdx}
              onChange={(e) => handleSelectReason(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-border, #cbd5e1)",
                color: "var(--color-foreground, #0f172a)",
                fontSize: "var(--font-size-sm, 14px)",
                fontWeight: 500,
                outline: "none",
              }}
            >
              {CANCEL_REASONS.map((r, i) => (
                <option key={r.label} value={i} style={{ background: "var(--color-surface, #ffffff)", color: "#0f172a" }}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-xs, 13px)", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
              Detailed Reason / Note to Citizen:
            </label>
            <textarea
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Explain why this report is being cancelled or dismissed…"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-border, #cbd5e1)",
                color: "var(--color-foreground, #0f172a)",
                fontSize: "var(--font-size-sm, 14px)",
                lineHeight: 1.5,
                resize: "vertical",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--font-size-xs, 13px)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isFake}
              onChange={(e) => setIsFake(e.target.checked)}
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
            <span style={{ color: isFake ? "var(--color-civic-red, #ef4444)" : "var(--color-foreground, #334155)", fontWeight: isFake ? 600 : 400 }}>
              Mark as confirmed false/malicious report (applies trust penalty to citizen)
            </span>
          </label>

          {error && (
            <div style={{ color: "#ef4444", fontSize: "var(--font-size-xs)", background: "rgba(239, 68, 68, 0.1)", padding: "8px 12px", borderRadius: "6px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Keep Report
            </Button>
            <button
              type="submit"
              disabled={submitting || !customReason.trim()}
              style={{
                background: "var(--color-civic-red, #dc2626)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-control, 8px)",
                padding: "10px 20px",
                fontWeight: 700,
                fontSize: "var(--font-size-sm, 14px)",
                cursor: "pointer",
                opacity: submitting || !customReason.trim() ? 0.6 : 1,
                boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
              }}
            >
              {submitting ? "Cancelling…" : "🚫 Confirm Cancel / Reject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
