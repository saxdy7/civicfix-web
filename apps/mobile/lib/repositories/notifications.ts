import { DEMO_NOTIFICATIONS } from "../demo-data";
import { supabase } from "../supabase";
import type { AppNotification } from "../types";

interface RawNotificationRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  issue_id: string | null;
}

export interface AppNotificationWithIssue extends AppNotification {
  issueId: string | null;
}

/**
 * Reads the real `notifications` table. It will legitimately be empty until
 * a backend job writes to it (FCM delivery isn't implemented yet — that's a
 * separate follow-up) — an honest empty state, not a bug.
 */
export async function fetchMyNotifications(userId: string): Promise<AppNotificationWithIssue[]> {
  if (!supabase) return DEMO_NOTIFICATIONS.map((n) => ({ ...n, issueId: null }));

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, created_at, read_at, issue_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as RawNotificationRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    read: row.read_at !== null,
    issueId: row.issue_id,
  }));
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("read_at", null);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}
