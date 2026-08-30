"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { IssueChat } from "@/components/IssueChat";
import { StatusPill } from "@/components/StatusPill";
import { maskReporter } from "@/lib/admin-mappers";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import styles from "../../admin.module.css";
import { CancelIssueModal } from "../CancelIssueModal";
import { EvidencePanel } from "./EvidencePanel";
import { IssueDetailsGuide } from "./IssueDetailsGuide";
import { ResolutionPanel } from "./ResolutionPanel";
import { TriagePanel } from "./TriagePanel";

type TabKey = "problem" | "assign" | "sop" | "completion";

export default function IssueTriagePage() {
  const { id } = useParams<{ id: string }>();
  const issue = useQuery(api.issues.getById, { issueId: id as Id<"issues"> });
  const mediaList = useQuery(api.issueMedia.listForIssue, id ? { issueId: id as Id<"issues"> } : "skip") ?? [];
  const [activeTab, setActiveTab] = useState<TabKey>("problem");
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (issue === undefined) return null;
  if (!issue) notFound();

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}`;
  const canCancel = issue.status !== "resolved" && issue.status !== "rejected";

  return (
    <div>
      <div style={{ marginBottom: "var(--space-2)" }}>
        <Link
          href="/admin/queue"
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-muted-foreground)",
            textDecoration: "none",
          }}
        >
          ← Back to issue queue
        </Link>
      </div>

      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div>
          <h1 className={styles.title}>{issue.trackingId}</h1>
          <p className={styles.subtitle}>
            {CATEGORY_LABEL[issue.category]} · {SEVERITY_LABEL[issue.severity]} severity · {issue.neighborhood ?? "Unspecified"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--color-civic-red, #ef4444)",
                padding: "6px 14px",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🚫 Cancel / Reject Report
            </button>
          )}
          <StatusPill status={issue.status} />
        </div>
      </div>

      {showCancelModal && (
        <CancelIssueModal
          issue={issue}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "var(--space-4)",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("problem")}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "problem" ? "2px solid var(--color-civic-blue, #0284c7)" : "2px solid transparent",
            color: activeTab === "problem" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
            fontWeight: activeTab === "problem" ? 700 : 500,
            fontSize: "var(--font-size-sm)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          📋 Problem Details & Photo
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assign")}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "assign" ? "2px solid var(--color-civic-blue, #0284c7)" : "2px solid transparent",
            color: activeTab === "assign" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
            fontWeight: activeTab === "assign" ? 700 : 500,
            fontSize: "var(--font-size-sm)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ⚡ Take Task & Assign
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sop")}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "sop" ? "2px solid var(--color-civic-blue, #0284c7)" : "2px solid transparent",
            color: activeTab === "sop" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
            fontWeight: activeTab === "sop" ? 700 : 500,
            fontSize: "var(--font-size-sm)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          🛠️ Work Order & SOP Steps
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("completion")}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "completion" ? "2px solid var(--color-civic-blue, #0284c7)" : "2px solid transparent",
            color: activeTab === "completion" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
            fontWeight: activeTab === "completion" ? 700 : 500,
            fontSize: "var(--font-size-sm)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ✅ Complete & Verify
        </button>
      </div>

      {/* TAB 1: ONLY Citizen Problem Details */}
      {activeTab === "problem" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Card>
            <h2 className={styles.sectionTitle}>📝 Problem Description</h2>
            <p style={{ margin: 0, fontSize: "1.1rem", lineHeight: 1.6, fontWeight: 500 }}>
              {issue.description || "No text description provided."}
            </p>
            <p style={{ margin: "var(--space-3) 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
              Reported by {maskReporter(issue.reporterId)} on {new Date(issue.createdAt).toLocaleString()}
            </p>
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}>📸 Photo of the Problem</h2>
            {issue.media && issue.media.length > 0 ? (
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
                {issue.media.map((m) =>
                  m.url ? (
                    <a
                      key={m._id}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        position: "relative",
                        maxWidth: "100%",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="Problem photo" style={{ width: "100%", maxHeight: "360px", objectFit: "cover" }} />
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
                        🔍 Click to expand
                      </span>
                    </a>
                  ) : null,
                )}
              </div>
            ) : mediaList.length > 0 ? (
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
                {mediaList.map((m) => (
                  <CitizenMediaPreview key={m._id} mediaId={m._id} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "var(--space-4)",
                  background: "var(--color-surface-muted)",
                  borderRadius: "8px",
                  textAlign: "center",
                  color: "var(--color-muted-foreground)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                📷 No photo was attached by the citizen during initial report submission.
              </div>
            )}
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                📍 Problem Location & GPS
              </h2>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  background: "var(--color-civic-blue, #0284c7)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "var(--font-size-xs)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Open in Google Maps ↗
              </a>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
              <div>
                <span style={{ color: "var(--color-muted-foreground)" }}>Neighborhood: </span>
                <strong>{issue.neighborhood || "Downtown District"}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-muted-foreground)" }}>Coordinates: </span>
                <code>
                  {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
                </code>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Task Assignment & Triage */}
      {activeTab === "assign" && (
        <div>
          <TriagePanel issue={issue} />
        </div>
      )}

      {/* TAB 3: SOP Work Order Steps & Tools */}
      {activeTab === "sop" && (
        <div>
          <IssueDetailsGuide issue={issue} />
        </div>
      )}

      {/* TAB 4: Mark Completion & Evidence */}
      {activeTab === "completion" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <EvidencePanel issue={issue} />
          <ResolutionPanel issue={issue} />
        </div>
      )}

      {/* Chat Section */}
      <div style={{ marginTop: "var(--space-5)" }}>
        <IssueChat issueId={issue._id} senderRole="staff" />
      </div>
    </div>
  );
}

function CitizenMediaPreview({ mediaId }: { mediaId: Id<"issueMedia"> }) {
  const url = useQuery(api.issueMedia.getUrl, { mediaId });
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: "relative",
        maxWidth: "100%",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        display: "block",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Problem photo" style={{ width: "100%", maxHeight: "360px", objectFit: "cover" }} />
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
        🔍 Click to expand
      </span>
    </a>
  );
}

