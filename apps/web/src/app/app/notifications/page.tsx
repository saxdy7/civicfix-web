import { Card } from "@civicfix/ui-web";

import { createServerSupabase, getSessionProfile } from "@/lib/supabase-server";

import styles from "../resident.module.css";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export default async function ResidentNotificationsPage() {
  const session = await getSessionProfile();
  const supabase = await createServerSupabase();

  let notifications: NotificationRow[] = [];

  if (supabase && session) {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, created_at, read_at")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    notifications = data ?? [];
  }

  if (notifications.length === 0) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Notifications</h1>
        </div>
        <Card>
          <p className={styles.emptyState}>
            Nothing yet. Status updates on your reports will land here.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Notifications</h1>
        <p className={styles.subtitle}>
          Every status change on a report you filed or confirmed.
        </p>
      </div>

      <div className={styles.reportList}>
        {notifications.map((n) => (
          <Card key={n.id} style={{ opacity: n.read_at ? 0.62 : 1 }}>
            <div className={styles.notifRow}>
              <span className={`${styles.notifDot} ${n.read_at ? styles.notifDotRead : ""}`} />
              <div>
                <p className={styles.notifTitle}>{n.title}</p>
                <p className={styles.notifBody}>{n.body}</p>
                <p className={styles.notifDate}>{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
