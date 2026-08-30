"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";

import { Card } from "@civicfix/ui-web";

import { IssueChat } from "@/components/IssueChat";
import { StatusPill } from "@/components/StatusPill";
import { CATEGORY_LABEL, SEVERITY_LABEL, STATUS_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { IssueStatus } from "@/lib/types";

import styles from "../../resident.module.css";

// The happy path a resident is walked through. Stages already reached come from
// the issue's own events; the rest are shown dimmed as "what happens next".
const EXPECTED: IssueStatus[] = ["reported", "triaged", "assigned", "in_progress", "pending_verification", "resolved"];

export default function ResidentReportDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const issue = useQuery(api.issues.getById, { issueId: id as Id<"issues"> });
  const updateStatus = useMutation(api.issues.updateStatus);
  const deleteIssue = useMutation(api.issues.deleteIssue);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (issue === undefined) return null;
  // getById already scopes visibility (own issue, or staff, or public) —
  // nothing further to check here.
  if (!issue) notFound();

  const reached = new Set(issue.events.map((e) => e.status));
  const upcoming = EXPECTED.filter((s) => !reached.has(s));
  const sortedEvents = [...issue.events].sort((a, b) => a.createdAt - a.createdAt);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteIssue({ issueId: issue._id, reason: "Deleted by resident from web portal" });
      router.push("/app/reports");
    } catch (err) {
      alert("Error deleting report: " + (err instanceof Error ? err.message : String(err)));
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/app/reports" style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
            ← All my reports
          </Link>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "var(--color-civic-red)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🗑️ Delete Report
          </button>
        </div>

        <h1 className={styles.title} style={{ marginTop: "var(--space-3)" }}>
          {issue.trackingId}
        </h1>
        <p className={styles.subtitle}>
          {CATEGORY_LABEL[issue.category]} · {issue.neighborhood ?? "Unspecified"}
        </p>
        <div style={{ marginTop: "var(--space-3)" }}>
          <StatusPill status={issue.status} />
        </div>
      </div>

      {showConfirm && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-4)",
            marginBottom: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <strong style={{ color: "var(--color-civic-red)" }}>⚠️ Delete this report?</strong>
          <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-foreground)" }}>
            Are you sure you want to delete report <strong>{issue.trackingId}</strong>? This action will remove the report from public tracking and cancel further dispatch.
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

      <div className={styles.detailGrid}>
        <div>
          <Card style={{ marginBottom: "var(--space-5)" }}>
            <h2 className={styles.sectionTitle}>What you reported</h2>
            <p style={{ margin: 0, lineHeight: 1.65 }}>{issue.description}</p>
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}>Status trail</h2>

            {sortedEvents.map((event, index) => (
              <div key={event._id} className={styles.timelineRow}>
                <div className={styles.timelineDotCol}>
                  <span className={styles.timelineDot} />
                  {index < sortedEvents.length - 1 || upcoming.length > 0 ? (
                    <span className={styles.timelineLine} />
                  ) : null}
                </div>
                <div className={styles.timelineBody}>
                  <p className={styles.timelineStatus}>{STATUS_SHORT_LABEL[event.status]}</p>
                  {event.note ? <p className={styles.timelineNote}>{event.note}</p> : null}
                  <p className={styles.timelineDate}>{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}

            {upcoming.map((status, index) => (
              <div key={status} className={styles.timelineRow}>
                <div className={styles.timelineDotCol}>
                  <span className={`${styles.timelineDot} ${styles.timelineDotFuture}`} />
                  {index < upcoming.length - 1 ? <span className={styles.timelineLine} /> : null}
                </div>
                <div className={styles.timelineBody}>
                  <p className={styles.timelineStatus} style={{ color: "var(--color-dim-foreground)" }}>
                    {STATUS_SHORT_LABEL[status]}
                  </p>
                  <p className={styles.timelineNote}>Not yet reached</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <Card>
            <h2 className={styles.sectionTitle}>Details</h2>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Status</span>
              <span>{STATUS_LABEL[issue.status]}</span>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Severity</span>
              <span>{SEVERITY_LABEL[issue.severity]}</span>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Neighborhood</span>
              <span>{issue.neighborhood ?? "Unspecified"}</span>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Reported</span>
              <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Last update</span>
              <span>{new Date(issue.updatedAt).toLocaleDateString()}</span>
            </div>
          </Card>

          {user ? (
            <div style={{ marginTop: "var(--space-4)" }}>
              <IssueChat issueId={issue._id} senderRole="resident" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

