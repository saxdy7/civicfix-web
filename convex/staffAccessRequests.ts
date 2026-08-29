import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, requireRole, requireUser } from "./lib/auth";

export const submit = mutation({
  args: {
    fullName: v.string(),
    workEmail: v.string(),
    employeeId: v.string(),
    departmentId: v.optional(v.id("departments")),
    requestedRole: v.union(v.literal("field_worker"), v.literal("department_manager")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.employeeId.trim().length < 3) throw new ConvexError("Enter your employee ID");

    const existing = await ctx.db
      .query("staffAccessRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.some((r) => r.status === "pending")) throw new ConvexError("You already have a pending request.");

    return await ctx.db.insert("staffAccessRequests", {
      userId: user._id,
      fullName: args.fullName.trim(),
      workEmail: args.workEmail.trim(),
      employeeId: args.employeeId.trim(),
      departmentId: args.departmentId,
      requestedRole: args.requestedRole,
      status: "pending",
      termsAcceptedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

/** Own request only, or every request if administrator — mirrors access_requests_select_own's RLS shape. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return [];
    const roles = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const admin = roles.some((r) => r.role === "administrator");

    if (admin) {
      const rows = await ctx.db.query("staffAccessRequests").collect();
      rows.sort((a, b) => b.createdAt - a.createdAt);
      return rows;
    }
    return await ctx.db
      .query("staffAccessRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const approve = mutation({
  args: { requestId: v.id("staffAccessRequests"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["administrator"]);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") throw new ConvexError("Request not found or already decided");
    if (!request.userId) throw new ConvexError("Request has no linked user account");

    await ctx.db.patch(request._id, {
      status: "approved",
      reviewedBy: actor._id,
      reviewedAt: Date.now(),
      reviewNote: args.note,
    });

    const already = await ctx.db
      .query("userRoles")
      .withIndex("by_user_and_role", (q) => q.eq("userId", request.userId!).eq("role", request.requestedRole))
      .unique();
    if (!already) {
      await ctx.db.insert("userRoles", {
        userId: request.userId,
        role: request.requestedRole,
        departmentId: request.departmentId,
        grantedBy: actor._id,
        grantedAt: Date.now(),
      });
    }

    const user = await ctx.db.get(request.userId);
    if (user && !user.employeeId) {
      await ctx.db.patch(user._id, { employeeId: request.employeeId, updatedAt: Date.now() });
    }

    await ctx.db.insert("auditLogs", {
      actorId: actor._id,
      action: "staff_access_request.approve",
      entityType: "staffAccessRequests",
      entityId: request._id,
      metadata: { grantedRole: request.requestedRole, userId: request.userId, note: args.note },
      createdAt: Date.now(),
    });
  },
});

export const reject = mutation({
  args: { requestId: v.id("staffAccessRequests"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["administrator"]);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") throw new ConvexError("Request not found or already decided");

    await ctx.db.patch(request._id, {
      status: "rejected",
      reviewedBy: actor._id,
      reviewedAt: Date.now(),
      reviewNote: args.note,
    });

    await ctx.db.insert("auditLogs", {
      actorId: actor._id,
      action: "staff_access_request.reject",
      entityType: "staffAccessRequests",
      entityId: request._id,
      metadata: { userId: request.userId, note: args.note },
      createdAt: Date.now(),
    });
  },
});
