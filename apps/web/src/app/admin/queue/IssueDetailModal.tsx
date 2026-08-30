"use client";

import { useQuery } from "convex/react";
import { Badge, Button } from "@civicfix/ui-web";

import { maskReporter } from "@/lib/admin-mappers";
import { CATEGORY_LABEL, SEVERITY_LABEL, STATUS_LABEL } from "@/lib/status";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

interface IssueDetailModalProps {
  issueId: Id<"issues">;
  onClose: () => void;
  onTakeTask?: (issueId: Id<"issues">) => void;
  onCancelIssue?: (issue: Doc<"issues">) => void;
}

export function IssueDetailModal({ issueId, onClose, onTakeTask, onCancelIssue }: IssueDetailModalProps) {
  const issue = useQuery(api.issues.getById, { issueId });
  const mediaList = useQuery(api.issueMedia.listForIssue, { issueId }) ?? [];

  if (issue === undefined) {
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
      >
        <div style={{ background: "var(--color-surface, #ffffff)", border: "1px solid var(--color-border, #e2e8f0)", padding: "var(--space-5)", borderRadius: "12px", color: "var(--color-foreground, #0f172a)", fontWeight: 600 }}>
          Loading issue details…
        </div>
      </div>
    );
  }

  if (!issue) return null;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}`;

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
          maxWidth: "680px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "var(--space-5)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          color: "var(--color-foreground, #0f172a)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--color-border, #e2e8f0)", paddingBottom: "var(--space-3)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "4px" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-foreground, #0f172a)" }}>{issue.trackingId}</span>
              <Badge tone={issue.severity === "critical" ? "danger" : issue.severity === "high" ? "warning" : "neutral"}>
                {SEVERITY_LABEL[issue.severity]} Severity
              </Badge>
              <Badge tone="info">{CATEGORY_LABEL[issue.category]}</Badge>
            </div>
            <p style={{ margin: 0, fontSize: "var(--font-size-xs, 12px)", color: "var(--color-muted-foreground, #64748b)" }}>
              Reported on {new Date(issue.createdAt).toLocaleString()} · Current Status: <strong style={{ color: "var(--color-foreground, #0f172a)" }}>{STATUS_LABEL[issue.status]}</strong>
            </p>
          </div>

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
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* 1. Problem Description */}
        <div style={{ background: "var(--color-surface-muted, #f8fafc)", border: "1px solid var(--color-border, #e2e8f0)", padding: "var(--space-4)", borderRadius: "8px" }}>
          <strong style={{ display: "block", fontSize: "var(--font-size-xs, 12px)", textTransform: "uppercase", color: "var(--color-civic-blue, #0284c7)", marginBottom: "var(--space-2)", letterSpacing: "0.5px" }}>
            📝 Citizen Problem Description
          </strong>
          <p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.6, fontWeight: 600, color: "var(--color-foreground, #0f172a)" }}>
            {issue.description || "No text description provided."}
          </p>
        </div>

        {/* 2. Photo of the Problem */}
        <div>
          <strong style={{ display: "block", fontSize: "var(--font-size-xs, 12px)", textTransform: "uppercase", color: "var(--color-muted-foreground, #64748b)", marginBottom: "var(--space-2)", letterSpacing: "0.5px" }}>
            📸 Photo of the Problem
          </strong>

          {issue.media && issue.media.length > 0 ? (
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {issue.media.map((m) =>
                m.url ? (
                  <a
                    key={m._id}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      position: "relative",
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid var(--color-border, #cbd5e1)",
                      maxWidth: "100%",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt="Citizen problem photo"
                      style={{ width: "100%", maxHeight: "320px", objectFit: "cover", display: "block" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        background: "rgba(0,0,0,0.75)",
                        color: "#fff",
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      🔍 Full size
                    </span>
                  </a>
                ) : null,
              )}
            </div>
          ) : mediaList.length > 0 ? (
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {mediaList.map((m) => (
                <MediaPreviewItem key={m._id} mediaId={m._id} />
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "var(--space-4)",
                background: "var(--color-surface-muted, #f8fafc)",
                border: "1px solid var(--color-border, #e2e8f0)",
                borderRadius: "8px",
                textAlign: "center",
                color: "var(--color-muted-foreground, #64748b)",
                fontSize: "var(--font-size-sm, 14px)",
              }}
            >
              📷 No photo was attached by the citizen during report submission.
            </div>
          )}
        </div>

        {/* 3. Location Details */}
        <div style={{ background: "var(--color-surface-muted, #f8fafc)", border: "1px solid var(--color-border, #e2e8f0)", padding: "var(--space-4)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <strong style={{ display: "block", fontSize: "var(--font-size-xs, 12px)", textTransform: "uppercase", color: "var(--color-muted-foreground, #64748b)", marginBottom: "4px", letterSpacing: "0.5px" }}>
              📍 Location Details
            </strong>
            <p style={{ margin: "0 0 4px", fontSize: "var(--font-size-sm, 14px)", fontWeight: 700, color: "var(--color-foreground, #0f172a)" }}>
              {issue.neighborhood || "Downtown / Civic District"}
            </p>
            <p style={{ margin: 0, fontSize: "var(--font-size-xs, 12px)", color: "var(--color-muted-foreground, #64748b)" }}>
              GPS: {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
            </p>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "var(--color-civic-blue, #0284c7)",
              color: "#ffffff",
              borderRadius: "6px",
              fontSize: "var(--font-size-xs, 13px)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            🗺️ Open in Google Maps ↗
          </a>
        </div>

        {/* 4. Reporter Details */}
        <div style={{ fontSize: "var(--font-size-xs, 13px)", color: "var(--color-muted-foreground, #64748b)" }}>
          Reported by: <strong style={{ color: "var(--color-foreground, #0f172a)" }}>{maskReporter(issue.reporterId)}</strong> · Department:{" "}
          <strong style={{ color: "var(--color-foreground, #0f172a)" }}>{issue.departmentName || "Unassigned"}</strong>
        </div>

        {/* Modal Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--color-border, #e2e8f0)", paddingTop: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div>
            {onCancelIssue && issue.status !== "resolved" && issue.status !== "rejected" && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCancelIssue(issue);
                }}
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "var(--color-civic-red, #dc2626)",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "var(--font-size-xs, 13px)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🚫 Cancel / Reject Report
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {onTakeTask && (issue.status === "reported" || issue.status === "triaged") && (
              <Button
                onClick={() => {
                  onClose();
                  onTakeTask(issue._id);
                }}
              >
                ⚡ Take this Task
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaPreviewItem({ mediaId }: { mediaId: Id<"issueMedia"> }) {
  const url = useQuery(api.issueMedia.getUrl, { mediaId });
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Citizen problem photo"
        style={{ width: "100%", maxHeight: "300px", objectFit: "cover", display: "block" }}
      />
      <span
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          fontSize: "11px",
          padding: "3px 8px",
          borderRadius: "4px",
        }}
      >
        🔍 Full size
      </span>
    </a>
  );
}
