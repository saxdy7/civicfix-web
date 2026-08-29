import Link from "next/link";

import { Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { isOverdue } from "@/lib/admin-mappers";
import { createServerSupabase } from "@/lib/supabase-server";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";
import type { IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

import styles from "../admin.module.css";

interface QueueRow {
  id: string;
  tracking_id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  created_at: string;
  departments: { name: string; sla_hours: number } | null;
}

async function loadQueue(): Promise<QueueRow[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("issues")
    .select("id, tracking_id, category, severity, status, created_at, departments(name, sla_hours)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []) as unknown as QueueRow[];
}

export default async function IssueQueuePage() {
  const issues = await loadQueue();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Issue queue</h1>
        <p className={styles.subtitle}>Triage incoming reports, review AI suggestions, and route to a department.</p>
      </div>

      <Card>
        {issues === null ? (
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to see live reports here.
          </p>
        ) : issues.length === 0 ? (
          <p className={styles.emptyState}>No reports yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => {
                  const overdue = isOverdue(issue.created_at, issue.departments?.sla_hours ?? 72, issue.status);
                  return (
                    <tr key={issue.id} style={overdue ? { background: "var(--color-civic-red-soft)" } : undefined}>
                      <td>
                        <Link href={`/admin/queue/${issue.id}`}>{issue.tracking_id}</Link>
                      </td>
                      <td>{CATEGORY_LABEL[issue.category]}</td>
                      <td>{SEVERITY_LABEL[issue.severity]}</td>
                      <td>{issue.departments?.name ?? "Unassigned"}</td>
                      <td>
                        <StatusPill status={issue.status} />
                      </td>
                      <td>{new Date(issue.created_at).toLocaleDateString()}</td>
                      <td>
                        {overdue ? (
                          <span style={{ color: "var(--color-civic-red)", fontWeight: 700 }}>⚠ Overdue</span>
                        ) : (
                          <span style={{ color: "var(--color-muted-foreground)" }}>On track</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
