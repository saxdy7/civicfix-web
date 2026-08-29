import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isStaff, requireUser } from "./lib/auth";

/** A resident sees only their own issue's chat; staff can open any issue's operational chat. */
export const listForIssue = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const issue = await ctx.db.get(args.issueId);
    if (!issue) return [];
    const staff = await isStaff(ctx, user._id);
    if (issue.reporterId !== user._id && !staff) return [];

    return await ctx.db
      .query("issueMessages")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .collect();
  },
});

export const send = mutation({
  args: { issueId: v.id("issues"), body: v.string(), senderRole: v.union(v.literal("resident"), v.literal("staff")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.body.trim().length === 0) throw new ConvexError("Message cannot be empty");

    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new ConvexError("Issue not found");
    const staff = await isStaff(ctx, user._id);
    if (args.senderRole === "resident" && issue.reporterId !== user._id) {
      throw new ConvexError("Not authorized to message on this issue");
    }
    if (args.senderRole === "staff" && !staff) throw new ConvexError("Not authorized to message as staff");

    const now = Date.now();
    const messageId = await ctx.db.insert("issueMessages", {
      issueId: args.issueId,
      senderId: user._id,
      senderRole: args.senderRole,
      body: args.body.trim(),
      deliveredAt: now,
      createdAt: now,
    });

    // Notify the other party — reporter <-> staff, whichever this sender isn't.
    const notifyUserId = args.senderRole === "resident" ? null : issue.reporterId;
    if (notifyUserId && notifyUserId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: notifyUserId,
        issueId: issue._id,
        title: "New message",
        body: `City staff sent a message about ${issue.trackingId}.`,
        createdAt: now,
      });
    }

    return messageId;
  },
});

export const markRead = mutation({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const messages = await ctx.db
      .query("issueMessages")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .collect();
    await Promise.all(
      messages
        .filter((m) => m.senderId !== user._id && !m.readAt)
        .map((m) => ctx.db.patch(m._id, { readAt: Date.now() })),
    );
  },
});

/** Report/moderate an abusive message — the message stays visible to staff for context, flagged for review. */
export const flag = mutation({
  args: { messageId: v.id("issueMessages"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.reason.trim().length < 5) throw new ConvexError("A reason is required to flag a message");
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Message not found");

    const issue = await ctx.db.get(message.issueId);
    const staff = await isStaff(ctx, user._id);
    if (!issue || (issue.reporterId !== user._id && !staff)) throw new ConvexError("Not authorized to flag this message");

    await ctx.db.patch(message._id, { flaggedAt: Date.now(), flaggedBy: user._id, flagReason: args.reason.trim() });
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      action: "message.flag",
      entityType: "issueMessages",
      entityId: message._id,
      metadata: { reason: args.reason },
      createdAt: Date.now(),
    });
  },
});
