import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getRoles, getViewer, requireRole, requireUser } from "./lib/auth";

/**
 * Idempotent Clerk → Convex identity sync. Call this once from each client
 * right after Clerk resolves a signed-in user (e.g. in a top-level
 * useEffect keyed on the Clerk user id) — cheap no-op on repeat calls.
 * New accounts default to the "citizen" role; nothing here ever grants a
 * staff or administrator role — those are server-side-only elevations
 * (see approveStaffAccessRequest / grantRole).
 */
export const ensureUser = mutation({
  args: { fullName: v.optional(v.string()), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in required");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName: args.fullName ?? existing.fullName,
        email: args.email ?? existing.email,
        updatedAt: now,
      });
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      fullName: args.fullName ?? identity.name,
      email: args.email ?? identity.email,
      trustScore: 100,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("userRoles", {
      userId,
      role: "citizen",
      grantedAt: now,
    });

    return userId;
  },
});

/** The signed-in user's own profile + roles — powers nav, profile pages, role-gated UI. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return null;
    const roles = await getRoles(ctx, user._id);
    return { ...user, roles };
  },
});

/** Look up a login identifier (email or employee ID) to the account's Clerk-facing email. */
export const resolveLoginEmail = query({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    if (args.identifier.includes("@")) return args.identifier;
    const user = await ctx.db
      .query("users")
      .withIndex("by_employee_id", (q) => q.eq("employeeId", args.identifier))
      .unique();
    return user?.email ?? null;
  },
});

/** Staff-only — every field worker, for the "assign a worker" dropdown. */
export const listFieldWorkers = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["department_manager", "administrator"]);
    const roleRows = await ctx.db
      .query("userRoles")
      .withIndex("by_role", (q) => q.eq("role", "field_worker"))
      .collect();
    return await Promise.all(
      roleRows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { id: r.userId, name: user?.fullName || user?.email || "Unnamed worker" };
      }),
    );
  },
});

/** Administrator-only — every user with a trust-score ledger event, for the trust-score review page. */
export const listTrustScores = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["administrator"]);
    const events = await ctx.db.query("trustScoreEvents").collect();
    const userIds = Array.from(new Set(events.map((e) => e.userId)));
    return await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        const userEvents = events.filter((e) => e.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
        return {
          userId,
          name: user?.fullName ?? "Unknown",
          email: user?.email ?? "—",
          trustScore: user?.trustScore ?? 100,
          restrictedUntil: user?.restrictedUntil,
          events: userEvents,
        };
      }),
    );
  },
});

/** Administrator-only staff directory for the Users & roles admin page. */
export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["administrator"]);

    const staffRoleRows = await ctx.db.query("userRoles").collect();
    const staffOnly = staffRoleRows.filter((r) => r.role !== "citizen");

    const rows = await Promise.all(
      staffOnly.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const department = r.departmentId ? await ctx.db.get(r.departmentId) : null;
        return {
          id: `${r.userId}:${r.role}`,
          userId: r.userId,
          name: user?.fullName ?? "Unnamed",
          email: user?.email ?? "—",
          role: r.role,
          department: department?.name,
        };
      }),
    );
    return rows;
  },
});

/** Administrator-only, audited role grant — never callable by a client to grant itself a role. */
export const grantRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("field_worker"),
      v.literal("department_manager"),
      v.literal("administrator"),
      v.literal("auditor"),
    ),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["administrator"]);

    const already = await ctx.db
      .query("userRoles")
      .withIndex("by_user_and_role", (q) => q.eq("userId", args.userId).eq("role", args.role))
      .unique();
    if (already) return already._id;

    const roleId = await ctx.db.insert("userRoles", {
      userId: args.userId,
      role: args.role,
      departmentId: args.departmentId,
      grantedBy: actor._id,
      grantedAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorId: actor._id,
      action: "role.grant",
      entityType: "users",
      entityId: args.userId,
      metadata: { role: args.role, departmentId: args.departmentId },
      createdAt: Date.now(),
    });

    return roleId;
  },
});

/**
 * Seeds (or repairs) the local/demo administrator account — see
 * scripts/seed-clerk-admin.mjs. Deliberately NOT auth-gated via
 * ctx.auth (a fresh admin account has no Clerk session to check against
 * yet) — instead requires a secret set only server-side via
 * `npx convex env set SEED_ADMIN_SECRET ...`, never sent to any client.
 * Without a matching secret this always throws, including for any
 * ordinary signed-in caller.
 */
export const seedAdministrator = mutation({
  args: { clerkId: v.string(), fullName: v.string(), email: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.SEED_ADMIN_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError("Not authorized");
    }

    const now = Date.now();
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    const userId =
      user?._id ??
      (await ctx.db.insert("users", {
        clerkId: args.clerkId,
        fullName: args.fullName,
        email: args.email,
        trustScore: 100,
        createdAt: now,
        updatedAt: now,
      }));

    const already = await ctx.db
      .query("userRoles")
      .withIndex("by_user_and_role", (q) => q.eq("userId", userId).eq("role", "administrator"))
      .unique();
    if (!already) {
      await ctx.db.insert("userRoles", { userId, role: "administrator", grantedAt: now });
    }
    return userId;
  },
});

/** Requires the caller to actually be signed in — used by pages that render nothing for guests. */
export const requireSignedIn = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return user._id;
  },
});
