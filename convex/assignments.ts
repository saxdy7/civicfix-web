import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getRoles, isStaff, requireRole, requireUser } from "./lib/auth";

async function notify(ctx: any, userId: any, issueId: any, title: string, body: string) {
  await ctx.db.insert("notifications", { userId, issueId, title, body, createdAt: Date.now() });
}

/** A field worker's own queue — only ever their own assignments, never anyone else's. */
export const myAssignments = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("assignments")
      .withIndex("by_worker", (q) => q.eq("workerId", user._id))
      .collect();
  },
});

/** Staff-only — every assignment plus its issue and worker, for the admin assignment board. */
export const listAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!(await isStaff(ctx, user._id))) return [];

    const limit = args.limit ?? 100;
    const rows = await ctx.db.query("assignments").order("desc").take(limit);
    return await Promise.all(
      rows.map(async (a) => {
        const issue = await ctx.db.get(a.issueId);
        const worker = await ctx.db.get(a.workerId);
        return { ...a, issue, workerName: worker?.fullName ?? worker?.email ?? "Unnamed worker" };
      }),
    );
  },
});

export const paginateAssignments = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!(await isStaff(ctx, user._id))) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    return await ctx.db.query("assignments").order("desc").paginate(args.paginationOpts);
  },
});

/** Staff-only — the most recent assignment for a given issue, for the triage/resolution panels. */
export const getByIssue = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!(await isStaff(ctx, user._id))) return null;

    const rows = await ctx.db
      .query("assignments")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const latest = rows[0];
    if (!latest) return null;
    const worker = await ctx.db.get(latest.workerId);
    return { ...latest, workerName: worker?.fullName ?? worker?.email ?? null };
  },
});

export const getById = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) return null;
    const roles = await getRoles(ctx, user._id);
    if (assignment.workerId !== user._id && !roles.some((r) => r !== "citizen")) return null;
    const issue = await ctx.db.get(assignment.issueId);
    return { ...assignment, issue };
  },
});

/** Staff-only — assigns a field worker and (from reported/triaged) advances the issue to 'assigned'. */
export const assignWorker = mutation({
  args: { issueId: v.id("issues"), workerId: v.id("users"), dueAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["department_manager", "administrator"]);

    const workerRoles = await getRoles(ctx, args.workerId);
    if (!workerRoles.includes("field_worker")) throw new ConvexError("Target user is not a field worker");

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");

    const dueAt = args.dueAt ?? Date.now() + 3 * 24 * 60 * 60 * 1000;
    const assignmentId = await ctx.db.insert("assignments", {
      issueId: issue._id,
      workerId: args.workerId,
      assignedBy: actor._id,
      dueAt,
      createdAt: Date.now(),
    });

    if (["reported", "triaged"].includes(issue.status)) {
      await ctx.db.patch(issue._id, { status: "assigned", updatedAt: Date.now() });
      await ctx.db.insert("issueEvents", {
        issueId: issue._id,
        status: "assigned",
        actorId: actor._id,
        note: "Assigned to a field worker.",
        createdAt: Date.now(),
      });
      if (issue.reporterId !== actor._id) {
        await notify(ctx, issue.reporterId, issue._id, "Work has been assigned", `A field worker has been assigned to ${issue.trackingId}.`);
      }
    }

    if (args.workerId !== actor._id) {
      await notify(ctx, args.workerId, issue._id, "New assignment", `You have been assigned to ${issue.trackingId}, due ${new Date(dueAt).toLocaleDateString()}.`);
    }

    await ctx.db.insert("auditLogs", {
      actorId: actor._id,
      action: "assignment.create",
      entityType: "assignments",
      entityId: assignmentId,
      metadata: { issueId: issue._id, workerId: args.workerId },
      createdAt: Date.now(),
    });

    return assignmentId;
  },
});

/** A worker accepting their own assignment — narrowly scoped, only ever writes to their own row. */
export const acceptAssignment = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || assignment.workerId !== user._id) throw new ConvexError("Assignment not found");

    await ctx.db.patch(assignment._id, { acceptedAt: Date.now() });

    const issue = await ctx.db.get(assignment.issueId);
    if (issue && issue.status === "assigned") {
      await ctx.db.patch(issue._id, { status: "in_progress", updatedAt: Date.now() });
      await ctx.db.insert("issueEvents", { issueId: issue._id, status: "in_progress", actorId: user._id, createdAt: Date.now() });
    }
  },
});
