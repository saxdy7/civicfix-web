import { DEMO_NOTIFICATIONS } from "../demo-data";
import { convexClient } from "../convex-client";
import type { AppNotification } from "../types";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface AppNotificationWithIssue extends AppNotification {
  issueId: string | null;
}

/**
 * Reads the real `notifications` table. It will legitimately be empty until
 * a backend job writes to it (FCM delivery isn't implemented yet — that's a
 * separate follow-up) — an honest empty state, not a bug.
 */
export async function fetchMyNotifications(_userId: string): Promise<AppNotificationWithIssue[]> {
  if (!convexClient) return DEMO_NOTIFICATIONS.map((n) => ({ ...n, issueId: null }));

  const rows = await convexClient.query(api.notifications.listMine, {});
  return rows.map((row) => ({
    id: row._id,
    title: row.title,
    body: row.body,
    createdAt: new Date(row.createdAt).toISOString(),
    read: row.readAt !== undefined,
    issueId: row.issueId ?? null,
  }));
}

export async function markNotificationRead(id: string, _userId: string): Promise<void> {
  if (!convexClient) return;
  await convexClient.mutation(api.notifications.markRead, { notificationId: id as Id<"notifications"> });
}

export async function markAllNotificationsRead(_userId: string): Promise<void> {
  if (!convexClient) return;
  await convexClient.mutation(api.notifications.markAllRead, {});
}
