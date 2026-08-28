import Link from "next/link";

import { Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { mapIssueRow, type RawIssueRow } from "@/lib/issue-mappers";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/status";
import { createServerSupabase, getSessionProfile } from "@/lib/supabase-server";
import type { Issue } from "@/lib/types";

import styles from "./resident.module.css";

export default async function ResidentOverviewPage() {
  const session = await getSessionProfile();
  const supabase = await createServerSupabase();

  let latest: Issue[] = [];
  let totalCount = 0;
  let openCount = 0;
  let resolvedCount = 0;
  let confirmedCount = 0;

  if (supabase && session) {
    const [
      { data: latestRows },
      { count: total },
      { count: open },
      { count: resolved },
      { count: confirmed },
    ] = await Promise.all([
      supabase
        .from("issues")
        .select("*, departments(name)")
        .eq("reporter_id", session.userId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("reporter_id", session.userId),
      supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("reporter_id", session.userId)
        .not("status", "in", "(resolved,rejected)"),
      supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("reporter_id", session.userId)
        .eq("status", "resolved"),
      supabase
        .from("confirmations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.userId),
    ]);

    latest = ((latestRows as RawIssueRow[] | null) ?? []).map((row) => mapIssueRow(row));
    totalCount = total ?? 0;
    openCount = open ?? 0;
    resolvedCount = resolved ?? 0;
    confirmedCount = confirmed ?? 0;
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Welcome back{session ? `, ${session.name}` : ""}</h1>
        <p className={styles.subtitle}>
          Everything you have reported, and where each one stands right now.
        </p>
      </div>

      <div className={styles.statGrid}>
        <Card>
          <span className={styles.statValue}>{totalCount}</span>
          <span className={styles.statLabel}>Reports filed</span>
        </Card>
        <Card>
          <span className={styles.statValue}>{openCount}</span>
          <span className={styles.statLabel}>Currently open</span>
        </Card>
        <Card>
          <span className={styles.statValue}>{resolvedCount}</span>
          <span className={styles.statLabel}>Resolved</span>
        </Card>
        <Card>
          <span className={styles.statValue}>{confirmedCount}</span>
          <span className={styles.statLabel}>Reports you confirmed</span>
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>Your latest reports</h2>

      {latest.length === 0 ? (
        <Card>
          <p className={styles.emptyState}>
            You have not filed a report yet. When you do, it will appear here with its live
            status.
          </p>
        </Card>
      ) : (
        <div className={styles.reportList}>
          {latest.map((issue) => (
            <Link key={issue.id} href={`/app/reports/${issue.id}`} style={{ textDecoration: "none" }}>
              <Card className={styles.reportRow}>
                <div className={styles.reportMain}>
                  <h3>
                    {CATEGORY_LABEL[issue.category]} · {issue.trackingId}
                  </h3>
                  <p>{STATUS_LABEL[issue.status]}</p>
                  <p className={styles.reportMeta}>
                    {issue.neighborhood} · Reported{" "}
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={issue.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
