import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/auth";

async function audit(ctx: any, actorId: any, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await ctx.db.insert("auditLogs", { actorId, action, entityType, entityId, metadata, createdAt: Date.now() });
}

export const latestForIssue = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("resolutionEvidence")
      .withIndex("by_issue_and_submitted", (q) => q.eq("issueId", args.issueId))
      .collect();
    rows.sort((a, b) => b.submittedAt - a.submittedAt);
    return rows[0] ?? null;
  },
});

/** Staff-only — before/after media must already exist via issueMedia.save(). Advances in_progress -> pending_verification. */
export const submit = mutation({
  args: {
    issueId: v.id("issues"),
    assignmentId: v.optional(v.id("assignments")),
    beforeMediaId: v.id("issueMedia"),
    afterMediaId: v.id("issueMedia"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user: actor, roles } = await requireRole(ctx, ["field_worker", "department_manager", "administrator"]);
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");

    if (args.beforeMediaId === args.afterMediaId) {
      throw new ConvexError("Before-work and after-work evidence photos must be distinct");
    }

    const beforeMedia = await ctx.db.get(args.beforeMediaId);
    if (!beforeMedia) throw new ConvexError("Before-work media record not found");
    if (beforeMedia.issueId !== issue._id) {
      throw new ConvexError("Before-work media does not belong to this issue");
    }

    const afterMedia = await ctx.db.get(args.afterMediaId);
    if (!afterMedia) throw new ConvexError("After-work media record not found");
    if (afterMedia.issueId !== issue._id) {
      throw new ConvexError("After-work media does not belong to this issue");
    }

    const isPrivilegedStaff = roles.some((r) => ["department_manager", "administrator"].includes(r));
    if (!isPrivilegedStaff) {
      // Must be the assigned worker on this issue
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
        .collect();
      const userAssignment = assignments.find((a) => a.workerId === actor._id);
      if (!userAssignment) {
        throw new ConvexError("You are not assigned to this issue");
      }
    }

    const evidenceId = await ctx.db.insert("resolutionEvidence", {
      issueId: issue._id,
      assignmentId: args.assignmentId,
      beforeMediaId: args.beforeMediaId,
      afterMediaId: args.afterMediaId,
      note: args.note?.trim() || undefined,
      submittedBy: actor._id,
      submittedAt: Date.now(),
    });

    if (args.assignmentId) {
      await ctx.db.patch(args.assignmentId, { completedAt: Date.now() });
    }

    if (issue.status === "in_progress" || issue.status === "assigned") {
      await ctx.db.patch(issue._id, { status: "pending_verification", updatedAt: Date.now(), version: issue.version + 1 });
      await ctx.db.insert("issueEvents", {
        issueId: issue._id,
        status: "pending_verification",
        actorId: actor._id,
        note: "Completion evidence submitted for verification.",
        createdAt: Date.now(),
      });
      if (issue.reporterId !== actor._id) {
        await ctx.db.insert("notifications", {
          userId: issue.reporterId,
          issueId: issue._id,
          title: "Ready for your review",
          body: `${issue.trackingId} has repair evidence submitted — check the Community tab to confirm it's fixed.`,
          createdAt: Date.now(),
        });
      }
    }

    await audit(ctx, actor._id, "evidence.submit", "resolutionEvidence", evidenceId, { issueId: issue._id });
    return evidenceId;
  },
});

/** Staff-driven verification, independent of community voting — an administrator/manager confirming the evidence themselves. */
export const verify = mutation({
  args: { evidenceId: v.id("resolutionEvidence"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["department_manager", "administrator"]);
    const evidence = await ctx.db.get(args.evidenceId);
    if (!evidence) throw new ConvexError("Evidence not found");
    if (evidence.verifiedAt) throw new ConvexError("This evidence is already verified");

    const now = Date.now();
    await ctx.db.patch(evidence._id, { verifiedBy: actor._id, verifiedAt: now });

    const issue = await ctx.db.get(evidence.issueId);
    if (issue && issue.status === "pending_verification") {
      await ctx.db.patch(issue._id, {
        status: "resolved",
        updatedAt: now,
        version: issue.version + 1,
      });
      await ctx.db.insert("issueEvents", {
        issueId: issue._id,
        status: "resolved",
        actorId: actor._id,
        note: args.note?.trim() || "Resolution evidence verified by staff.",
        createdAt: now,
      });
      if (issue.reporterId !== actor._id) {
        await ctx.db.insert("notifications", {
          userId: issue.reporterId,
          issueId: issue._id,
          title: "Report resolved",
          body: `${issue.trackingId} has been verified and resolved by city staff.`,
          createdAt: now,
        });
      }
    }

    await audit(ctx, actor._id, "evidence.verify", "resolutionEvidence", evidence._id, {
      issueId: evidence.issueId,
      note: args.note,
    });
  },
});
