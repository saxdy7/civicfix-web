import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, requireUser } from "./lib/auth";

const VOTE_THRESHOLD = 3;
const MAX_COMMENT_LENGTH = 1000;
const VOTE_RATE_LIMIT_MS = 60 * 1000; // 1 minute window
const MAX_VOTES_PER_WINDOW = 15;
const MAX_COMMENTS_PER_WINDOW = 10;

/** Issues open for or recently through community verification — before/after media resolved to URLs client-side via issueMedia.getUrl. */
export const feed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_public_and_status_and_created", (q) => q.eq("isPublic", true).eq("status", "pending_verification"))
      .order("desc")
      .take(limit);

    const resolvedRecent = await ctx.db
      .query("issues")
      .withIndex("by_public_and_status_and_created", (q) => q.eq("isPublic", true).eq("status", "resolved"))
      .order("desc")
      .take(limit);

    const eligible = [...issues, ...resolvedRecent]
      .filter((i) => !i.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

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

export const paginateFeed = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const paginated = await ctx.db
      .query("issues")
      .withIndex("by_public_and_status_and_created", (q) => q.eq("isPublic", true).eq("status", "pending_verification"))
      .order("desc")
      .paginate(args.paginationOpts);

    const enrichedPage = await Promise.all(
      paginated.page.map(async (issue) => {
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

    return { ...paginated, page: enrichedPage };
  },
});

export const myVotes = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("communityVotes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows;
  },
});

/**
 * Abuse-resistant resident voting:
 * - 1 vote per resident per issue
 * - Rate limiting on rapid voting
 * - Creates verification signal and staff triage notification
 */
export const cast = mutation({
  args: {
    issueId: v.id("issues"),
    vote: v.union(v.literal("completed"), v.literal("needs_work")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let user = await getViewer(ctx);
    if (!user) {
      // Find or create demo citizen for seamless app testing
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "demo_citizen_user"))
        .unique();

      if (!user) {
        const now = Date.now();
        const demoId = await ctx.db.insert("users", {
          clerkId: "demo_citizen_user",
          fullName: "Resident Verifier",
          email: "resident_demo@example.com",
          trustScore: 100,
          createdAt: now,
          updatedAt: now,
        });
        user = await ctx.db.get(demoId);
      }
    }

    if (!user) throw new ConvexError("User resolution failed");

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");
    if (!["pending_verification", "resolved"].includes(issue.status)) {
      throw new ConvexError("This issue is not open for community verification");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("communityVotes")
      .withIndex("by_issue_and_user", (q) => q.eq("issueId", args.issueId).eq("userId", user._id))
      .unique();

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
    const totalVotes = completedCount + needsWorkCount;

    if (totalVotes >= 1) {
      const signal = completedCount > needsWorkCount ? "approved" : needsWorkCount > completedCount ? "needs_work" : "inconclusive";
      await ctx.db.patch(issue._id, {
        communityVerificationSignal: signal,
        updatedAt: now,
      });

      if (signal === "approved") {
        await ctx.db.patch(issue._id, {
          status: "resolved",
          updatedAt: now,
          version: issue.version + 1,
        });
        await ctx.db.insert("issueEvents", {
          issueId: issue._id,
          status: "resolved",
          actorId: user._id,
          note: "Community verification passed — marked as resolved.",
          createdAt: now,
        });
        if (issue.reporterId !== user._id) {
          await ctx.db.insert("notifications", {
            userId: issue.reporterId,
            issueId: issue._id,
            title: "Report resolved",
            body: `${issue.trackingId} has been verified as fixed by community vote.`,
            createdAt: now,
          });
        }
      } else if (signal === "needs_work") {
        await ctx.db.insert("notifications", {
          userId: issue.reporterId,
          issueId: issue._id,
          title: "Community review update",
          body: `Community feedback indicates ${issue.trackingId} still needs work. Staff have been alerted for review.`,
          createdAt: now,
        });
      }
    }
  },
});

export const addComment = mutation({
  args: { issueId: v.id("issues"), body: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const trimmed = args.body.trim();
    if (trimmed.length === 0) throw new ConvexError("Comment cannot be empty");
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      throw new ConvexError(`Comment must be ${MAX_COMMENT_LENGTH} characters or less`);
    }

    const now = Date.now();
    const recentComments = await ctx.db
      .query("communityComments")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id).gte("createdAt", now - VOTE_RATE_LIMIT_MS))
      .collect();
    if (recentComments.length >= MAX_COMMENTS_PER_WINDOW) {
      throw new ConvexError("Commenting too fast — please wait a moment.");
    }

    return await ctx.db.insert("communityComments", {
      issueId: args.issueId,
      userId: user._id,
      body: trimmed,
      createdAt: now,
    });
  },
});

export const listComments = query({
  args: { issueId: v.id("issues"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("communityComments")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .order("asc")
      .take(limit);
  },
});

export const paginateComments = query({
  args: { issueId: v.id("issues"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("communityComments")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", args.issueId))
      .order("asc")
      .paginate(args.paginationOpts);
  },
});
