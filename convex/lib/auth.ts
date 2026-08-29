import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

const STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"] as const;
export type Role = (typeof STAFF_ROLES)[number] | "citizen";

/**
 * Resolves the Convex `users` row for the calling Clerk identity, or null
 * if unauthenticated. Never trusts anything from the client beyond the
 * verified JWT — role membership is a separate, server-only lookup below.
 */
export async function getViewer(ctx: Ctx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Throws if unauthenticated. Use in any mutation/query that requires a signed-in user. */
export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getViewer(ctx);
  if (!user) throw new ConvexError("Sign in required");
  return user;
}

/** Every role currently held by this user — always a fresh DB read, never cached client-side. */
export async function getRoles(ctx: Ctx, userId: Id<"users">): Promise<Role[]> {
  const rows = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.map((r) => r.role);
}

export async function isStaff(ctx: Ctx, userId: Id<"users">): Promise<boolean> {
  const roles = await getRoles(ctx, userId);
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}

export async function isAdmin(ctx: Ctx, userId: Id<"users">): Promise<boolean> {
  const roles = await getRoles(ctx, userId);
  return roles.includes("administrator");
}

/** Throws unless the signed-in user holds one of the allowed roles. Returns the user + their roles. */
export async function requireRole(
  ctx: Ctx,
  allowed: Role[],
): Promise<{ user: Doc<"users">; roles: Role[] }> {
  const user = await requireUser(ctx);
  const roles = await getRoles(ctx, user._id);
  if (!roles.some((r) => allowed.includes(r))) {
    throw new ConvexError("Not authorized for this action");
  }
  return { user, roles };
}
