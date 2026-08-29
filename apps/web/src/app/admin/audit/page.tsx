"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Button, Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";

import styles from "../admin.module.css";

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--color-civic-blue)",
  warning: "var(--color-civic-amber)",
  critical: "var(--color-civic-red)",
};

export default function DailyAuditPage() {
  const run = useQuery(api.dailyAudit.latest, {});
  const runNow = useMutation(api.dailyAudit.runNow);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunNow = async () => {
    setRunning(true);
    setError(null);
    try {
      await runNow({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run the audit.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className={styles.title}>Daily audit</h1>
          <p className={styles.subtitle}>
            A Convex scheduled job runs this automatically at 02:00 UTC every day and stores the result — this
            page always shows the most recent stored run.
          </p>
        </div>
        <Button onClick={handleRunNow} disabled={running}>
          {running ? "Running…" : "Run now"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className={styles.errorText} style={{ marginBottom: "var(--space-4)" }}>
          {error}
        </p>
      ) : null}

      {run === undefined ? (
        <Card>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      ) : !run ? (
        <Card>
          <p className={styles.emptyState}>
            No audit run has completed yet — click &quot;Run now&quot; to generate the first one, or wait for
            the next scheduled run at 02:00 UTC.
          </p>
        </Card>
      ) : (
        <>
          <div className={styles.statGrid}>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{run.statusIntegrityPassed ? "Pass" : "Fail"}</span>
              <span className={styles.statLabel}>Status integrity</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{run.slaBreachesCount}</span>
              <span className={styles.statLabel}>SLA breaches</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{run.missingEvidenceCount}</span>
              <span className={styles.statLabel}>Missing evidence</span>
            </Card>
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{run.unresolvedCriticalCount}</span>
              <span className={styles.statLabel}>Unresolved critical</span>
            </Card>
          </div>

          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", margin: "0 0 var(--space-4)" }}>
            Last run {new Date(run.runAt).toLocaleString()}
          </p>

          <Card>
            {run.findings.length === 0 ? (
              <p className={styles.emptyState}>No findings on the last run — everything checked out.</p>
            ) : (
              run.findings.map((finding, i) => (
                <div key={i} className={styles.findingRow} style={{ marginBottom: "var(--space-4)" }}>
                  <div className={styles.findingDot} style={{ background: SEVERITY_COLOR[finding.severity] }} />
                  <div>
                    <p className={styles.findingCategory}>{finding.category}</p>
                    <p className={styles.findingTitle}>{finding.title}</p>
                    <p className={styles.findingDescription}>{finding.description}</p>
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}
