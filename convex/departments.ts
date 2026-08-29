import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/auth";

const CATEGORY = v.union(v.literal("pothole"), v.literal("garbage"), v.literal("streetlight"), v.literal("other"));

export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("departments").collect(),
});

/** Category → best-fit department, used by the AI-triage auto-route and the manual routing dropdown. */
export const findByCategory = query({
  args: { category: CATEGORY },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("departments").collect();
    return all.find((d) => d.categories.includes(args.category)) ?? null;
  },
});

export const create = mutation({
  args: { name: v.string(), categories: v.array(CATEGORY), slaHours: v.number() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["administrator"]);
    return await ctx.db.insert("departments", { ...args, createdAt: Date.now() });
  },
});
