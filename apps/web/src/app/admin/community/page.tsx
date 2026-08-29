"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

import { Badge, Card } from "@civicfix/ui-web";

import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";

import styles from "../admin.module.css";

export default function AdminCommunityPage() {
  const feed = useQuery(api.communityVotes.feed, {});

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Community votes &amp; comments</h1>
        <p className={styles.subtitle}>
          Oversight of resident-driven verification — a &quot;Still needs work&quot; majority auto-reopens the
          issue; contested splits are worth a closer look here.
        </p>
      </div>

      <Card>
        {feed === undefined ? (
          <p className={styles.emptyState}>Loading…</p>
        ) : feed.length === 0 ? (
          <p className={styles.emptyState}>Nothing is in community verification right now.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Completed votes</th>
                  <th>Needs-work votes</th>
                  <th>Comments</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {feed.map((item) => {
                  const contested = item.completedCount > 0 && item.needsWorkCount > 0;
                  return (
                    <tr key={item.issue._id} style={contested ? { background: "var(--color-civic-amber-soft)" } : undefined}>
                      <td>
                        <Link href={`/admin/queue/${item.issue._id}`}>{item.issue.trackingId}</Link>
                      </td>
                      <td>{CATEGORY_LABEL[item.issue.category]}</td>
                      <td>
                        <Badge tone={item.issue.status === "resolved" ? "success" : "info"}>
                          {STATUS_SHORT_LABEL[item.issue.status]}
                        </Badge>
                      </td>
                      <td>{item.completedCount}</td>
                      <td>{item.needsWorkCount}</td>
                      <td>{item.commentCount}</td>
                      <td>{contested ? <Badge tone="warning">Contested</Badge> : null}</td>
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
