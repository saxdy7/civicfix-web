import { notFound } from "next/navigation";

import { Card } from "@civicfix/ui-web";

import { PublicShell } from "@/components/PublicShell";
import { StatusPill } from "@/components/StatusPill";
import {
  mapIssueRow,
  type RawIssueEventRow,
  type RawIssueRow,
} from "@/lib/issue-mappers";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import { createServerSupabase } from "@/lib/supabase-server";

import styles from "./page.module.css";

export default async function IssueDetailPage({ params }: PageProps<"/issues/[id]">) {
  const { id } = await params;

  const supabase = await createServerSupabase();
  if (!supabase) notFound();

  // RLS (`issues_select_public`) returns this row only if it is public, or
  // belongs to the signed-in caller, or the caller is staff — anything else
  // comes back as no row, which we treat the same as "not found".
  const { data: row } = await supabase
    .from("issues")
    .select("*, departments(name)")
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  const { data: eventRows } = await supabase
    .from("issue_events")
    .select("id, status, note, created_at")
    .eq("issue_id", id)
    .order("created_at", { ascending: true });

  const issue = mapIssueRow(row as RawIssueRow, (eventRows as RawIssueEventRow[] | null) ?? []);

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
                    {index < issue.events.length - 1 ? <div className={styles.timelineLine} /> : null}
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
