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

export const seedDefaults = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.SEED_ADMIN_SECRET;
    if (!expected || args.secret !== expected) {
      throw new Error("Invalid seed secret");
    }
    const existing = await ctx.db.query("departments").collect();
    if (existing.length > 0) return existing.map((d) => d._id);

    const now = Date.now();
    const defaults = [
      { name: "Public Works & Infrastructure", categories: ["pothole" as const], slaHours: 48 },
      { name: "Sanitation & Waste Management", categories: ["garbage" as const], slaHours: 24 },
      { name: "Electrical & Public Lighting", categories: ["streetlight" as const], slaHours: 36 },
      { name: "General Civic Services", categories: ["other" as const], slaHours: 72 },
    ];

    const ids = [];
    for (const d of defaults) {
      const id = await ctx.db.insert("departments", { ...d, createdAt: now });
      ids.push(id);
    }
    return ids;
  },
});
