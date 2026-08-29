import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

const VOTE_THRESHOLD = 3;

/** Issues open for or recently through community verification — before/after media resolved to URLs client-side via issueMedia.getUrl. */
export const feed = query({
  args: {},
  handler: async (ctx) => {
    const issues = await ctx.db.query("issues").collect();
    const eligible = issues.filter(
      (i) => i.isPublic && !i.deletedAt && ["pending_verification", "resolved"].includes(i.status),
    );

    return await Promise.all(
      eligible.map(async (issue) => {
        const evidenceRows = await ctx.db
          .query("resolutionEvidence")
          .withIndex("by_issue_and_submitted", (q) => q.eq("issueId", issue._id))
          .collect();
        evidenceRows.sort((a, b) => b.submittedAt - a.submittedAt);
        const evidence = evidenceRows[0] ?? null;

        const votes = await ctx.db
          .query("communityVotes")
          .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
          .collect();
        const completedCount = votes.filter((v) => v.vote === "completed").length;
        const needsWorkCount = votes.filter((v) => v.vote === "needs_work").length;

        const comments = await ctx.db
          .query("communityComments")
          .withIndex("by_issue_and_time", (q) => q.eq("issueId", issue._id))
          .collect();

        return { issue, evidence, completedCount, needsWorkCount, commentCount: comments.length };
      }),
    );
  },
});

export const myVotes = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("communityVotes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows;
  },
});

/**
 * One vote per resident per issue (upsert, so changing your mind is a
 * plain re-vote). Reporters can't vote on their own issue. At
 * VOTE_THRESHOLD+ total votes on a pending_verification issue, a strict
 * majority auto-resolves or auto-reopens it.
 */
export const cast = mutation({
  args: { issueId: v.id("issues"), vote: v.union(v.literal("completed"), v.literal("needs_work")), comment: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");
    if (!["pending_verification", "resolved"].includes(issue.status)) {
      throw new ConvexError("This issue is not open for community verification");
    }
    if (issue.reporterId === user._id) throw new ConvexError("You cannot vote on your own report");

    const existing = await ctx.db
      .query("communityVotes")
      .withIndex("by_issue_and_user", (q) => q.eq("issueId", args.issueId).eq("userId", user._id))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { vote: args.vote, comment: args.comment?.trim() || undefined, updatedAt: now });
    } else {
      await ctx.db.insert("communityVotes", {
        issueId: args.issueId,
        userId: user._id,
        vote: args.vote,
        comment: args.comment?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (issue.status !== "pending_verification") return;

    const votes = await ctx.db
      .query("communityVotes")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .collect();
    const completedCount = votes.filter((v) => v.vote === "completed").length;
    const needsWorkCount = votes.filter((v) => v.vote === "needs_work").length;
    if (completedCount + needsWorkCount < VOTE_THRESHOLD) return;

    if (completedCount > needsWorkCount) {
      const evidence = await ctx.db
        .query("resolutionEvidence")
        .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
        .collect();
      if (evidence.length === 0) return;
      await Promise.all(
        evidence.filter((e) => !e.verifiedAt).map((e) => ctx.db.patch(e._id, { verifiedAt: now })),
      );

      await ctx.db.patch(issue._id, { status: "resolved", updatedAt: now, version: issue.version + 1 });
      await ctx.db.insert("issueEvents", {
        issueId: issue._id,
        status: "resolved",
        note: `Verified by community vote (${completedCount} completed vs ${needsWorkCount} needs work).`,
        createdAt: now,
      });
      await ctx.db.insert("auditLogs", {
        actorId: user._id,
        action: "community.auto_resolve",
        entityType: "issues",
        entityId: issue._id,
        metadata: { completedCount, needsWorkCount },
        createdAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: issue.reporterId,
        issueId: issue._id,
        title: "Verified resolved",
        body: `Your neighbors confirmed ${issue.trackingId} is fixed.`,
        createdAt: now,
      });
    } else if (needsWorkCount > completedCount) {
      await ctx.db.patch(issue._id, { status: "reopened", updatedAt: now, version: issue.version + 1 });
      await ctx.db.insert("issueEvents", {
        issueId: issue._id,
        status: "reopened",
        note: `Reopened by community vote (${needsWorkCount} needs work vs ${completedCount} completed).`,
        createdAt: now,
      });
      await ctx.db.insert("auditLogs", {
        actorId: user._id,
        action: "community.auto_reopen",
        entityType: "issues",
        entityId: issue._id,
        metadata: { completedCount, needsWorkCount },
        createdAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: issue.reporterId,
        issueId: issue._id,
        title: "Reopened after review",
        body: `Neighbors flagged ${issue.trackingId} as still needing work.`,
        createdAt: now,
      });
    }
  },
});

export const addComment = mutation({
  args: { issueId: v.id("issues"), body: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.body.trim().length === 0) throw new ConvexError("Comment cannot be empty");
    return await ctx.db.insert("communityComments", {
      issueId: args.issueId,
      userId: user._id,
      body: args.body.trim(),
      createdAt: Date.now(),
    });
  },
});

export const listComments = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("communityComments")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .collect(),
});
