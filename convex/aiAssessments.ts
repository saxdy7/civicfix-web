import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const latestForIssue = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("aiAssessments")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows[0] ?? null;
  },
});

const CATEGORY = v.union(v.literal("pothole"), v.literal("garbage"), v.literal("streetlight"), v.literal("other"));
const SEVERITY = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"));

/**
 * Records an AI triage result (called after the client-side /api/ai-triage
 * suggestion is shown) and, when confident enough, auto-routes a still-
 * unrouted fresh report to the matching department.
 */
export const record = mutation({
  args: {
    issueId: v.id("issues"),
    category: CATEGORY,
    severity: SEVERITY,
    confidence: v.number(),
    reasoning: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const issue = await ctx.db.get(args.issueId);
    if (!issue) return;
    if (issue.reporterId !== user._id) return; // staff-recorded assessments go through a separate audited path

    await ctx.db.insert("aiAssessments", {
      issueId: args.issueId,
      provider: args.provider ?? "groq",
      model: args.model ?? "unknown",
      promptVersion: "v1",
      inputHash: `${args.issueId}-${Date.now()}`,
      output: { category: args.category, severity: args.severity, reasoning: args.reasoning },
      confidence: args.confidence,
      createdAt: Date.now(),
    });

    if (args.confidence < 0.75 || issue.departmentId || issue.status !== "reported") return;

    const departments = await ctx.db.query("departments").collect();
    const match = departments.find((d) => d.categories.includes(args.category));
    if (!match) return;

    await ctx.db.patch(issue._id, { departmentId: match._id, updatedAt: Date.now() });
    await ctx.db.insert("issueEvents", {
      issueId: issue._id,
      status: "reported",
      note: `Auto-routed to ${match.name} by AI triage (${Math.round(args.confidence * 100)}% confidence).`,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      action: "ai.auto_route",
      entityType: "issues",
      entityId: issue._id,
      metadata: { departmentId: match._id, confidence: args.confidence },
      createdAt: Date.now(),
    });
  },
});
