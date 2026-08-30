import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getRoles, getViewer, isStaff, requireUser } from "./lib/auth";

const MAX_MESSAGE_LENGTH = 2000;

type Ctx = QueryCtx | MutationCtx;

async function canAccessIssueChat(ctx: Ctx, userId: Id<"users">, issue: Doc<"issues">): Promise<boolean> {
  if (issue.reporterId === userId) return true;
  const roles = await getRoles(ctx, userId);
  const staff = await isStaff(ctx, userId);
  if (staff) {
    if (!issue.departmentId) return true;
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
      .collect();
    if (assignments.some((a) => a.workerId === userId)) {
      return true;
    }
  }
  return false;
}

/** A resident sees only their own issue's chat; staff can open chats within their authorized scope. */
export const listForIssue = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const user = await getViewer(ctx);
    if (!user) return [];
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) return [];

    const allowed = await canAccessIssueChat(ctx, user._id, issue);
    if (!allowed) return [];

    return await ctx.db
      .query("issueMessages")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .collect();
  },
});

export const paginateForIssue = query({
  args: { issueId: v.id("issues"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await getViewer(ctx);
    if (!user) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const allowed = await canAccessIssueChat(ctx, user._id, issue);
    if (!allowed) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    return await ctx.db
      .query("issueMessages")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const send = mutation({
  args: {
    issueId: v.id("issues"),
    body: v.string(),
    senderRole: v.union(v.literal("resident"), v.literal("staff")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const trimmed = args.body.trim();
    if (trimmed.length === 0) throw new ConvexError("Message cannot be empty");
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new ConvexError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less`);
    }

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");

    const allowed = await canAccessIssueChat(ctx, user._id, issue);
    if (!allowed) throw new ConvexError("Not authorized to chat on this issue");

    if (args.senderRole === "staff") {
      const staff = await isStaff(ctx, user._id);
      if (!staff) throw new ConvexError("Not authorized to message as staff");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("issueMessages", {
      issueId: args.issueId,
      senderId: user._id,
      senderRole: args.senderRole,
      body: trimmed,
      deliveredAt: now,
      createdAt: now,
    });

    // Notify the other party — reporter <-> staff.
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
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) return;

    const allowed = await canAccessIssueChat(ctx, user._id, issue);
    if (!allowed) throw new ConvexError("Not authorized to mark messages read on this issue");

    const messages = await ctx.db
      .query("issueMessages")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .collect();

    const now = Date.now();
    await Promise.all(
      messages
        .filter((m) => m.senderId !== user._id && !m.readAt)
        .map((m) => ctx.db.patch(m._id, { readAt: now })),
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
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");

    const allowed = await canAccessIssueChat(ctx, user._id, issue);
    if (!allowed) throw new ConvexError("Not authorized to flag this message");

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
