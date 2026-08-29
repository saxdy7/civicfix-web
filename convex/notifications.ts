import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .collect();
    return rows.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== user._id) return;
    await ctx.db.patch(notification._id, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .collect();
    await Promise.all(rows.map((r) => ctx.db.patch(r._id, { readAt: Date.now() })));
  },
});

/** Registers/refreshes an FCM device token for push delivery — see convex/push.ts for the send-side action. */
export const registerDeviceToken = mutation({
  args: { fcmToken: v.string(), platform: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("fcmToken", args.fcmToken))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { userId: user._id, lastSeenAt: now });
      return existing._id;
    }
    return await ctx.db.insert("deviceTokens", { userId: user._id, fcmToken: args.fcmToken, platform: args.platform, createdAt: now, lastSeenAt: now });
  },
});
