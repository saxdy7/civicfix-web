import { Card } from "@civicfix/ui-web";

import { createServerSupabase } from "@/lib/supabase-server";
import type { AuditFinding } from "@/lib/types";

import styles from "../admin.module.css";

const SEVERITY_COLOR: Record<AuditFinding["severity"], string> = {
  info: "var(--color-civic-blue)",
  warning: "var(--color-civic-amber)",
  critical: "var(--color-civic-red)",
};

async function loadFindings(): Promise<AuditFinding[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [untriagedRes, resolvedRes, evidenceRes] = await Promise.all([
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "reported")
      .in("severity", ["high", "critical"])
      .lt("created_at", cutoff24h),
    supabase.from("issues").select("id").is("deleted_at", null).eq("status", "resolved"),
    supabase.from("resolution_evidence").select("issue_id, after_media_id"),
  ]);

  const findings: AuditFinding[] = [];

  const untriagedCount = untriagedRes.count ?? 0;
  if (untriagedCount > 0) {
    findings.push({
      id: "sla-untriaged",
      title: `${untriagedCount} high-severity issue${untriagedCount === 1 ? "" : "s"} untriaged past 24h`,
      description: "These reports were filed with high or critical severity and have not yet moved out of 'reported' within the SLA window.",
      severity: "warning",
      category: "SLA",
    });
  }

  const resolvedIds = new Set((resolvedRes.data ?? []).map((r) => r.id));
  const evidenceByIssue = new Map<string, boolean>();
  (evidenceRes.data ?? []).forEach((row) => {
    if (row.after_media_id) evidenceByIssue.set(row.issue_id, true);
  });
  const missingEvidenceCount = Array.from(resolvedIds).filter((id) => !evidenceByIssue.get(id)).length;
  if (missingEvidenceCount > 0) {
    findings.push({
      id: "evidence-missing",
      title: `${missingEvidenceCount} resolved issue${missingEvidenceCount === 1 ? "" : "s"} missing after-photo evidence`,
      description: "These issues are marked resolved without an after-photo on file in resolution_evidence.",
      severity: "critical",
      category: "Evidence integrity",
    });
  }

  return findings;
}

export default async function DailyAuditPage() {
  const findings = await loadFindings();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Daily audit</h1>
        <p className={styles.subtitle}>
          Computed live from current data on each page load — there is no scheduled daily audit job yet, so
          nothing here is a stored historical run.
        </p>
      </div>

      <Card>
        {findings === null ? (
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to run these checks against live data.
          </p>
        ) : (
          <>
            {findings.length === 0 ? (
              <p className={styles.emptyState}>No SLA or evidence-integrity issues detected right now.</p>
            ) : (
              findings.map((finding) => (
                <div key={finding.id} className={styles.findingRow} style={{ marginBottom: "var(--space-4)" }}>
                  <div className={styles.findingDot} style={{ background: SEVERITY_COLOR[finding.severity] }} />
                  <div>
                    <p className={styles.findingCategory}>{finding.category}</p>
                    <p className={styles.findingTitle}>{finding.title}</p>
                    <p className={styles.findingDescription}>{finding.description}</p>
                  </div>
                </div>
              ))
            )}
            <div className={styles.findingRow}>
              <div className={styles.findingDot} style={{ background: "var(--color-muted-foreground)" }} />
              <div>
                <p className={styles.findingCategory}>Notifications &amp; backups</p>
                <p className={styles.findingTitle}>Not tracked yet</p>
                <p className={styles.findingDescription}>
                  FCM delivery retries and backup/restore verification have no backing job runner or
                  storage in this build, so there is nothing real to report here — this is deliberately
                  left blank rather than showing a fabricated number.
                </p>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
