import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    return rows;
  },
});

export const paginateMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
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

/** Registers/refreshes an FCM / Expo device token for push delivery. */
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
    return await ctx.db.insert("deviceTokens", {
      userId: user._id,
      fcmToken: args.fcmToken,
      platform: args.platform,
      createdAt: now,
      lastSeenAt: now,
    });
  },
});

/** Server-only internal query — never callable directly by external client users. */
export const getUserDeviceTokensInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deviceTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/** Server-only token invalidation cleanup helper. */
export const removeInvalidDeviceTokenInternal = internalMutation({
  args: { fcmToken: v.string() },
  handler: async (ctx, args) => {
    const tokenRow = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("fcmToken", args.fcmToken))
      .unique();
    if (tokenRow) {
      await ctx.db.delete(tokenRow._id);
    }
  },
});

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!prefs) {
      return {
        pushEnabled: true,
        statusUpdates: true,
        chatMessages: true,
        communityAlerts: true,
      };
    }
    return prefs;
  },
});

export const updatePreferences = mutation({
  args: {
    pushEnabled: v.boolean(),
    statusUpdates: v.boolean(),
    chatMessages: v.boolean(),
    communityAlerts: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        pushEnabled: args.pushEnabled,
        statusUpdates: args.statusUpdates,
        chatMessages: args.chatMessages,
        communityAlerts: args.communityAlerts,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("notificationPreferences", {
      userId: user._id,
      pushEnabled: args.pushEnabled,
      statusUpdates: args.statusUpdates,
      chatMessages: args.chatMessages,
      communityAlerts: args.communityAlerts,
      updatedAt: now,
    });
  },
});

