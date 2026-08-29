"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { StatusPill } from "@/components/StatusPill";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";

import styles from "../resident.module.css";

export default function MyReportsPage() {
  const mine = useQuery(api.issues.list, { onlyMine: true });
  const sorted = [...(mine ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);

  if (mine === undefined) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>My reports</h1>
        </div>
        <Card>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      </div>
    );
  }

  if (sorted.length === 0) {
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
        {sorted.map((issue) => (
          <Link key={issue._id} href={`/app/reports/${issue._id}`} style={{ textDecoration: "none" }}>
            <Card className={styles.reportRow}>
              <div className={styles.reportMain}>
                <h3>
                  <span className={styles.trackingId}>{issue.trackingId}</span> ·{" "}
                  {CATEGORY_LABEL[issue.category]}
                </h3>
                <p>{issue.description}</p>
                <p className={styles.reportMeta}>
                  {issue.neighborhood ?? "Unspecified"} · {STATUS_LABEL[issue.status]} · Updated{" "}
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
