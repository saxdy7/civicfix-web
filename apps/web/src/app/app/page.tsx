"use client";

import Link from "next/link";

import { Card } from "@civicfix/ui-web";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";

import { StatusPill } from "@/components/StatusPill";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";

import styles from "./resident.module.css";

export default function ResidentOverviewPage() {
  const { user } = useUser();
  const myIssues = useQuery(api.issues.list, { onlyMine: true });

  const loading = myIssues === undefined;
  const totalCount = myIssues?.length ?? 0;
  const openCount = myIssues?.filter((i) => !["resolved", "rejected"].includes(i.status)).length ?? 0;
  const resolvedCount = myIssues?.filter((i) => i.status === "resolved").length ?? 0;
  const latest = [...(myIssues ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Welcome back{user?.firstName ? `, ${user.firstName}` : ""}</h1>
        <p className={styles.subtitle}>
          Everything you have reported, and where each one stands right now.
        </p>
      </div>

      <div className={styles.statGrid}>
        <Card>
          <span className={styles.statValue}>{loading ? "—" : totalCount}</span>
          <span className={styles.statLabel}>Reports filed</span>
        </Card>
        <Card>
          <span className={styles.statValue}>{loading ? "—" : openCount}</span>
          <span className={styles.statLabel}>Currently open</span>
        </Card>
        <Card>
          <span className={styles.statValue}>{loading ? "—" : resolvedCount}</span>
          <span className={styles.statLabel}>Resolved</span>
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>Your latest reports</h2>

      {latest.length === 0 ? (
        <Card>
          <p className={styles.emptyState}>
            {loading
              ? "Loading…"
              : "You have not filed a report yet. When you do, it will appear here with its live status."}
          </p>
        </Card>
      ) : (
        <div className={styles.reportList}>
          {latest.map((issue) => (
            <Link key={issue._id} href={`/app/reports/${issue._id}`} style={{ textDecoration: "none" }}>
              <Card className={styles.reportRow}>
                <div className={styles.reportMain}>
                  <h3>
                    {CATEGORY_LABEL[issue.category]} · {issue.trackingId}
                  </h3>
                  <p>{STATUS_LABEL[issue.status]}</p>
                  <p className={styles.reportMeta}>
                    {issue.neighborhood ?? "Unspecified"} · Reported{" "}
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
