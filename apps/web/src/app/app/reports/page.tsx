import Link from "next/link";

import { Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { mapIssueRow, type RawIssueRow } from "@/lib/issue-mappers";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/status";
import { createServerSupabase, getSessionProfile } from "@/lib/supabase-server";
import type { Issue } from "@/lib/types";

import styles from "../resident.module.css";

export default async function MyReportsPage() {
  const session = await getSessionProfile();
  const supabase = await createServerSupabase();

  let mine: Issue[] = [];

  if (supabase && session) {
    const { data } = await supabase
      .from("issues")
      .select("*, departments(name)")
      .eq("reporter_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    mine = ((data as RawIssueRow[] | null) ?? []).map((row) => mapIssueRow(row));
  }

  if (mine.length === 0) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>My reports</h1>
        </div>
        <Card>
          <p className={styles.emptyState}>
            You have not filed a report yet. When you do, it will appear here with its live
            status.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>My reports</h1>
        <p className={styles.subtitle}>
          Every report you have filed, newest first. Open one to see its full status trail.
        </p>
      </div>

      <div className={styles.reportList}>
        {mine.map((issue) => (
          <Link key={issue.id} href={`/app/reports/${issue.id}`} style={{ textDecoration: "none" }}>
            <Card className={styles.reportRow}>
              <div className={styles.reportMain}>
                <h3>
                  <span className={styles.trackingId}>{issue.trackingId}</span> ·{" "}
                  {CATEGORY_LABEL[issue.category]}
                </h3>
                <p>{issue.description}</p>
                <p className={styles.reportMeta}>
                  {issue.neighborhood} · {STATUS_LABEL[issue.status]} · Updated{" "}
                  {new Date(issue.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <StatusPill status={issue.status} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
