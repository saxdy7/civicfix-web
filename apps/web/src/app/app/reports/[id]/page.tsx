"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

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
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const issue = useQuery(api.issues.getById, { issueId: id as Id<"issues"> });

  if (issue === undefined) return null;
  // getById already scopes visibility (own issue, or staff, or public) —
  // nothing further to check here.
  if (!issue) notFound();

  const reached = new Set(issue.events.map((e) => e.status));
  const upcoming = EXPECTED.filter((s) => !reached.has(s));
  const sortedEvents = [...issue.events].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div>
      <div className={styles.pageHeader}>
        <Link href="/app/reports" style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
          ← All my reports
        </Link>
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
