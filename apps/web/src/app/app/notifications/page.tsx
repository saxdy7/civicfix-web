"use client";

import { useMutation, useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";

import styles from "../resident.module.css";

export default function ResidentNotificationsPage() {
  const notifications = useQuery(api.notifications.listMine, {});
  const markRead = useMutation(api.notifications.markRead);

  if (notifications === undefined) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Notifications</h1>
        </div>
        <Card>
          <p className={styles.emptyState}>Loading…</p>
        </Card>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Notifications</h1>
        </div>
        <Card>
          <p className={styles.emptyState}>Nothing yet. Status updates on your reports will land here.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Notifications</h1>
        <p className={styles.subtitle}>Every status change on a report you filed or confirmed.</p>
      </div>

      <div className={styles.reportList}>
        {notifications.map((n) => (
          <Card
            key={n._id}
            style={{ opacity: n.readAt ? 0.62 : 1, cursor: n.readAt ? "default" : "pointer" }}
            onClick={() => !n.readAt && markRead({ notificationId: n._id })}
          >
            <div className={styles.notifRow}>
              <span className={`${styles.notifDot} ${n.readAt ? styles.notifDotRead : ""}`} />
              <div>
                <p className={styles.notifTitle}>{n.title}</p>
                <p className={styles.notifBody}>{n.body}</p>
                <p className={styles.notifDate}>{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
