import { notFound } from "next/navigation";
import { Card } from "@civicfix/ui-web";

import { ConfirmButton } from "@/components/ConfirmButton";
import { PublicShell } from "@/components/PublicShell";
import { StatusPill } from "@/components/StatusPill";
import {
  mapIssueRow,
  type RawIssueEventRow,
  type RawIssueRow,
} from "@/lib/issue-mappers";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import { createServerSupabase } from "@/lib/supabase-server";
import { MOCK_ISSUES } from "@/lib/mock-data";
import type { Issue } from "@/lib/types";

import styles from "./page.module.css";

export default async function IssueDetailPage({ params }: PageProps<"/issues/[id]">) {
  const { id } = await params;

  let issue: Issue | null = null;
  let reporterId: string | null = null;
  let currentUserId: string | null = null;
  let confirmCount = 0;
  let alreadyConfirmed = false;
  const supabase = await createServerSupabase();

  if (supabase) {
    const [{ data: row }, { data: userData }] = await Promise.all([
      supabase.from("issues").select("*, departments(name)").eq("id", id).maybeSingle(),
      supabase.auth.getUser(),
    ]);
    currentUserId = userData.user?.id ?? null;

    if (row) {
      reporterId = row.reporter_id ?? null;
      const [{ data: eventRows }, { count }, { data: myConfirmation }] = await Promise.all([
        supabase
          .from("issue_events")
          .select("id, status, note, created_at")
          .eq("issue_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("confirmations")
          .select("id", { count: "exact", head: true })
          .eq("issue_id", id),
        currentUserId
          ? supabase.from("confirmations").select("id").eq("issue_id", id).eq("user_id", currentUserId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      confirmCount = count ?? 0;
      alreadyConfirmed = Boolean(myConfirmation);
      issue = mapIssueRow(row as RawIssueRow, (eventRows as RawIssueEventRow[] | null) ?? []);
    }
  }

  // Fallback to mock issues if not in DB (preview / demo mode)
  if (!issue) {
    const mockMatch = MOCK_ISSUES.find(
      (m) => m.id === id || m.trackingId.toLowerCase() === id.toLowerCase()
    );
    if (mockMatch) {
      issue = mockMatch;
    }
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
          <Card style={{ marginBottom: "var(--space-5)" }}>
            <h2 className={styles.sectionTitle}>Community</h2>
            <ConfirmButton
              issueId={issue.id}
              userId={currentUserId}
              isReporter={reporterId !== null && reporterId === currentUserId}
              initialConfirmed={alreadyConfirmed}
              initialCount={confirmCount}
            />
          </Card>

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
