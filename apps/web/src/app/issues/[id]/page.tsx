import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { Card } from "@civicfix/ui-web";

import { PublicShell } from "@/components/PublicShell";
import { StatusPill } from "@/components/StatusPill";
import { mapConvexIssue } from "@/lib/issue-mappers";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import { MOCK_ISSUES } from "@/lib/mock-data";
import type { Issue } from "@/lib/types";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import styles from "./page.module.css";

/** Convex document ids are opaque lowercase base32-ish strings — distinct enough from a "CF-xxxxx" tracking id or a mock "iss-1" id to route on. */
function looksLikeConvexId(value: string): boolean {
  return /^[a-z0-9]{20,}$/i.test(value) && !value.toUpperCase().startsWith("CF-");
}

export default async function IssueDetailPage({ params }: PageProps<"/issues/[id]">) {
  const { id } = await params;

  let issue: Issue | null = null;

  if (looksLikeConvexId(id)) {
    const { getToken } = await auth();
    const token = (await getToken({ template: "convex" })) ?? undefined;
    const doc = await fetchQuery(api.issues.getById, { issueId: id as Id<"issues"> }, { token }).catch(() => null);
    if (doc) {
      issue = mapConvexIssue(doc, { departmentName: doc.departmentName, events: doc.events });
    }
  }

  // Fallback to mock issues if not in Convex (preview / demo mode).
  if (!issue) {
    const mockMatch = MOCK_ISSUES.find(
      (m) => m.id === id || m.trackingId.toLowerCase() === id.toLowerCase(),
    );
    if (mockMatch) issue = mockMatch;
  }

  if (!issue) notFound();

  return (
    <PublicShell>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{issue.trackingId}</h1>
          <p className={styles.meta}>
            {CATEGORY_LABEL[issue.category]} · {issue.neighborhood}
          </p>
        </div>
        <StatusPill status={issue.status} />
      </div>

      <div className={styles.grid}>
        <div>
          <Card style={{ marginBottom: "var(--space-5)" }}>
            <h2 className={styles.sectionTitle}>Description</h2>
            <p style={{ margin: 0 }}>{issue.description}</p>
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}>Status timeline</h2>
            {issue.events.length === 0 ? (
              <p style={{ margin: 0, color: "var(--color-muted-foreground)" }}>
                No status updates yet.
              </p>
            ) : (
              issue.events.map((event, index) => (
                <div key={event.id} className={styles.timelineRow}>
                  <div className={styles.timelineDotCol}>
                    <div className={styles.timelineDot} />
                    {index < (issue?.events.length ?? 0) - 1 ? (
                      <div className={styles.timelineLine} />
                    ) : null}
                  </div>
                  <div className={styles.timelineBody}>
                    <p className={styles.timelineStatus}>{STATUS_SHORT_LABEL[event.status]}</p>
                    {event.note ? <p className={styles.timelineNote}>{event.note}</p> : null}
                    <p className={styles.timelineDate}>{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <div>
          <Card>
            <h2 className={styles.sectionTitle}>At a glance</h2>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Current status</span>
              <span>{STATUS_LABEL[issue.status]}</span>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Neighborhood</span>
              <span>{issue.neighborhood}</span>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Reported</span>
              <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.sideStatLabel}>Last updated</span>
              <span>{new Date(issue.updatedAt).toLocaleDateString()}</span>
            </div>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
