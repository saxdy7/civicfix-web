import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isStaff, requireRole, requireUser } from "./lib/auth";

const CATEGORY = v.union(v.literal("pothole"), v.literal("garbage"), v.literal("streetlight"), v.literal("other"));
const SEVERITY = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"));
const STATUS = v.union(
  v.literal("reported"),
  v.literal("triaged"),
  v.literal("duplicate"),
  v.literal("assigned"),
  v.literal("in_progress"),
  v.literal("pending_verification"),
  v.literal("resolved"),
  v.literal("reopened"),
  v.literal("rejected"),
);

// Mirrors spec/ARCHITECTURE.md's permitted-transition table exactly.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  reported: ["triaged", "duplicate", "rejected"],
  triaged: ["assigned", "duplicate", "rejected"],
  assigned: ["in_progress", "triaged"],
  in_progress: ["pending_verification", "triaged"],
  pending_verification: ["resolved", "reopened"],
  resolved: ["reopened"],
  reopened: ["assigned", "triaged"],
  duplicate: [],
  rejected: [],
};

const RESTRICTED_REPORT_THRESHOLD = 3;

async function audit(
  ctx: any,
  actorId: Id<"users"> | undefined,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: unknown,
) {
  await ctx.db.insert("auditLogs", { actorId, action, entityType, entityId, metadata, createdAt: Date.now() });
}

async function notify(ctx: any, userId: Id<"users">, issueId: Id<"issues">, title: string, body: string) {
  await ctx.db.insert("notifications", { userId, issueId, title, body, createdAt: Date.now() });
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Resident report submission with automated routing recommendation.
 * Tracking ID is server-generated, and every new report always starts
 * `reported`/public/unrouted regardless of what the client sends.
 */
export const create = mutation({
  args: {
    category: CATEGORY,
    description: v.string(),
    severity: SEVERITY,
    latitude: v.number(),
    longitude: v.number(),
    accuracyM: v.optional(v.number()),
    neighborhood: v.optional(v.string()),
    isEmergency: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const reporter = await requireUser(ctx);

    if (args.latitude < -90 || args.latitude > 90 || args.longitude < -180 || args.longitude > 180) {
      throw new ConvexError("Location out of bounds");
    }
    if (args.description.trim().length < 15) {
      throw new ConvexError("Description must be at least 15 characters");
    }
    if (reporter.restrictedUntil && reporter.restrictedUntil > Date.now()) {
      throw new ConvexError("Your account is temporarily restricted from filing new reports");
    }

    const now = Date.now();
    const trackingId = `CF-${Math.floor(10000 + Math.random() * 89999)}-${now.toString(36).slice(-4)}`;

    // Automatic Routing Recommendation (Algorithm based on category, municipality policy, and SLA)
    const departments = await ctx.db.query("departments").collect();
    const matchedDept = departments.find((d) => (d.categories as string[]).includes(args.category)) ?? departments[0];

    const suggestedDepartmentId = matchedDept?._id;
    const routingReason = args.isEmergency
      ? `🚨 EMERGENCY HAZARD: Expedited 4-hour SLA dispatch recommended for ${matchedDept?.name ?? "Public Safety"}.`
      : matchedDept
      ? `Auto-recommended for ${matchedDept.name} (${matchedDept.slaHours}h SLA target) based on category '${args.category}'.`
      : "General triage queue recommendation.";

    const finalSeverity = args.isEmergency ? "critical" : args.severity;

    const issueId = await ctx.db.insert("issues", {
      trackingId,
      reporterId: reporter._id,
      category: args.category,
      description: args.description.trim(),
      severity: finalSeverity,
      priority: finalSeverity,
      status: "reported",
      isEmergency: args.isEmergency ?? false,
      endorsementCount: 1,
      suggestedDepartmentId,
      routingReason,
      isPublic: true,
      version: 1,
      falseReportStatus: "none",
      latitude: args.latitude,
      longitude: args.longitude,
      accuracyM: args.accuracyM,
      neighborhood: args.neighborhood,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("issueEvents", {
      issueId,
      status: "reported",
      actorId: reporter._id,
      note: args.isEmergency
        ? `🚨 EMERGENCY HAZARD REPORTED. High-priority response required.`
        : `Report filed. Suggested routing: ${matchedDept?.name ?? "Triage Queue"}.`,
      createdAt: now,
    });

    if (args.isEmergency) {
      // Notify staff/managers immediately
      const staffRoles = await ctx.db
        .query("userRoles")
        .withIndex("by_role")
        .filter((q) =>
          q.or(
            q.eq(q.field("role"), "department_manager"),
            q.eq(q.field("role"), "administrator"),
          ),
        )
        .collect();

      const uniqueStaffIds = Array.from(new Set(staffRoles.map((r) => r.userId)));
      for (const staffId of uniqueStaffIds) {
        await ctx.db.insert("notifications", {
          userId: staffId,
          issueId,
          title: `🚨 Emergency Hazard: ${trackingId}`,
          body: `An urgent public hazard (${args.category}) was reported at ${args.neighborhood ?? "pinned location"}.`,
          createdAt: now,
        });
      }
    }

    await audit(ctx, reporter._id, "issue.create", "issues", issueId, {
      category: args.category,
      severity: finalSeverity,
      isEmergency: args.isEmergency,
      suggestedDepartmentId,
    });

    return { id: issueId, trackingId, suggestedDepartmentId, routingReason };
  },
});

/**
 * Smart Endorsement (+1 I see this too).
 * Allows a resident to confirm an existing nearby report instead of filing a duplicate.
 */
export const endorse = mutation({
  args: {
    issueId: v.id("issues"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) {
      throw new ConvexError("Issue not found");
    }

    const now = Date.now();

    // Check if user already voted or endorsed
    const existingVote = await ctx.db
      .query("communityVotes")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("issueId"), args.issueId))
      .first();

    if (existingVote) {
      return { success: true, trackingId: issue.trackingId, alreadyEndorsed: true };
    }

    // Insert endorsement vote
    await ctx.db.insert("communityVotes", {
      issueId: args.issueId,
      userId: user._id,
      vote: "completed",
      comment: args.note ?? "Confirmed seeing this issue (+1 pre-submission endorsement)",
      createdAt: now,
      updatedAt: now,
    });

    const newCount = (issue.endorsementCount ?? 1) + 1;
    await ctx.db.patch(args.issueId, {
      endorsementCount: newCount,
      updatedAt: now,
    });

    await ctx.db.insert("issueEvents", {
      issueId: args.issueId,
      status: issue.status,
      actorId: user._id,
      note: `Resident confirmed seeing this issue (+1 endorsement, total ${newCount}).`,
      createdAt: now,
    });

    // Notify original reporter
    if (issue.reporterId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: issue.reporterId,
        issueId: issue._id,
        title: `+1 Endorsement on ${issue.trackingId}`,
        body: `A neighbor confirmed seeing this ${issue.category} at your reported location.`,
        createdAt: now,
      });
    }

    await audit(ctx, user._id, "issue.endorse", "issues", args.issueId, {
      endorsementCount: newCount,
    });

    return { success: true, trackingId: issue.trackingId, endorsementCount: newCount };
  },
});

export const getById = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) return null;

    const viewer = await requireOptionalUser(ctx);
    const staff = viewer ? await isStaff(ctx, viewer._id) : false;
    if (!issue.isPublic && issue.reporterId !== viewer?._id && !staff) return null;

    const events = await ctx.db
      .query("issueEvents")
      .withIndex("by_issue_and_time", (q) => q.eq("issueId", issue._id))
      .collect();
    const department = issue.departmentId ? await ctx.db.get(issue.departmentId) : null;
    const suggestedDepartment = issue.suggestedDepartmentId ? await ctx.db.get(issue.suggestedDepartmentId) : null;

    return {
      ...issue,
      events,
      departmentName: department?.name ?? null,
      suggestedDepartmentName: suggestedDepartment?.name ?? null,
    };
  },
});

async function requireOptionalUser(ctx: any): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db.query("users").withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject)).unique();
}

/** Public map / queue listing, filterable. */
export const list = query({
  args: {
    status: v.optional(STATUS),
    category: v.optional(CATEGORY),
    departmentId: v.optional(v.id("departments")),
    onlyMine: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireOptionalUser(ctx);
    const staff = viewer ? await isStaff(ctx, viewer._id) : false;

    let rows: Doc<"issues">[];
    if (args.onlyMine && viewer) {
      rows = await ctx.db
        .query("issues")
        .withIndex("by_reporter_and_created", (q) => q.eq("reporterId", viewer._id))
        .order("desc")
        .take(args.limit ?? 100);
    } else if (args.departmentId) {
      rows = await ctx.db
        .query("issues")
        .withIndex("by_department_and_status", (q) => q.eq("departmentId", args.departmentId))
        .take(args.limit ?? 100);
    } else if (args.status) {
      rows = await ctx.db
        .query("issues")
        .withIndex("by_status_and_created", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 100);
    } else {
      rows = await ctx.db.query("issues").withIndex("by_created").order("desc").take(args.limit ?? 100);
    }

    rows = rows.filter((r) => !r.deletedAt);
    if (!staff) rows = rows.filter((r) => r.isPublic || r.reporterId === viewer?._id);
    if (args.category) rows = rows.filter((r) => r.category === args.category);
    if (args.status && !args.departmentId) rows = rows.filter((r) => r.status === args.status);

    return rows;
  },
});

export const paginateIssues = query({
  args: {
    status: v.optional(STATUS),
    category: v.optional(CATEGORY),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("issues")
        .withIndex("by_status_and_created", (q) => q.eq("status", args.status!))
        .order("desc")
        .paginate(args.paginationOpts);
    }
    if (args.category) {
      return await ctx.db
        .query("issues")
        .withIndex("by_category_and_created", (q) => q.eq("category", args.category!))
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("issues")
      .withIndex("by_created")
      .order("desc")
  },
});

/** Convex has no PostGIS ST_DWithin — this is the equivalent nearby-similar-report check. */
export const findNearbySimilar = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    category: CATEGORY,
    radiusM: v.optional(v.number()),
    excludeIssueId: v.optional(v.id("issues")),
  },
  handler: async (ctx, args) => {
    const radius = args.radiusM ?? 200;
    const candidates = await ctx.db
      .query("issues")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();

    return candidates
      .filter(
        (i) =>
          i.isPublic &&
          !i.deletedAt &&
          !["resolved", "rejected", "duplicate"].includes(i.status) &&
          i._id !== args.excludeIssueId,
      )
      .map((i) => ({ ...i, distanceM: haversineMeters(args.latitude, args.longitude, i.latitude, i.longitude) }))
      .filter((i) => i.distanceM <= radius)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 5);
  },
});

/** Staff-only status/severity transition — validated, evented, audited, notified. Mirrors update_issue_status. */
export const updateStatus = mutation({
  args: {
    issueId: v.id("issues"),
    nextStatus: v.optional(STATUS),
    severity: v.optional(SEVERITY),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["field_worker", "department_manager", "administrator", "auditor"]);

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");

    if (args.nextStatus && args.nextStatus !== issue.status) {
      const allowed = ALLOWED_TRANSITIONS[issue.status] ?? [];
      if (!allowed.includes(args.nextStatus)) {
        throw new ConvexError(`Cannot move an issue from ${issue.status} to ${args.nextStatus}`);
      }
      if (["rejected", "reopened"].includes(args.nextStatus) && (args.note?.trim().length ?? 0) < 10) {
        throw new ConvexError("A reason of at least 10 characters is required to reject or reopen an issue");
      }
      if (args.nextStatus === "resolved") {
        const evidence = await ctx.db
          .query("resolutionEvidence")
          .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
          .collect();
        if (!evidence.some((e) => e.verifiedAt)) {
          throw new ConvexError("This issue has no verified resolution evidence on file");
        }
      }

      await ctx.db.patch(issue._id, { status: args.nextStatus, updatedAt: Date.now(), version: issue.version + 1 });
      await ctx.db.insert("issueEvents", {
        issueId: issue._id,
        status: args.nextStatus,
        actorId: actor._id,
        note: args.note?.trim() || undefined,
        createdAt: Date.now(),
      });

      if (issue.reporterId !== actor._id) {
        const titles: Record<string, string> = {
          triaged: "Your report is being reviewed",
          assigned: "Work has been assigned",
          in_progress: "Work has started",
          pending_verification: "Ready for your review",
          resolved: "Report resolved",
          reopened: "Report reopened",
          rejected: "Report closed",
          duplicate: "Linked as a duplicate",
        };
        await notify(
          ctx,
          issue.reporterId,
          issue._id,
          titles[args.nextStatus] ?? "Report updated",
          `${issue.trackingId} is now: ${args.nextStatus.replace(/_/g, " ")}.${args.note ? ` ${args.note}` : ""}`,
        );
      }
    }

    if (args.severity && args.severity !== issue.severity) {
      await ctx.db.patch(issue._id, { severity: args.severity, updatedAt: Date.now(), version: issue.version + 1 });
    }

    if (args.nextStatus || args.severity) {
      await audit(ctx, actor._id, "issue.status_change", "issues", issue._id, {
        fromStatus: issue.status,
        toStatus: args.nextStatus,
        fromSeverity: issue.severity,
        toSeverity: args.severity,
        note: args.note,
      });
    }
  },
});

/** Staff-only — every issue currently under false-report review, for the admin trust/false-report queue. */
export const listFalseReportQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["administrator"]);
    const all = await ctx.db.query("issues").collect();
    return all.filter((i) => i.falseReportStatus === "under_review");
  },
});

export const routeToDepartment = mutation({
  args: { issueId: v.id("issues"), departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["department_manager", "administrator"]);
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");
    const department = await ctx.db.get(args.departmentId);
    if (!department) throw new ConvexError("Department not found");

    const nextStatus = issue.status === "triaged" ? "assigned" : issue.status;
    await ctx.db.patch(issue._id, {
      departmentId: args.departmentId,
      status: nextStatus,
      updatedAt: Date.now(),
      version: issue.version + 1,
    });

    if (nextStatus !== issue.status) {
      await ctx.db.insert("issueEvents", {
        issueId: issue._id,
        status: nextStatus,
        actorId: actor._id,
        note: "Routed to department.",
        createdAt: Date.now(),
      });
    }

    if (issue.reporterId !== actor._id) {
      await notify(ctx, issue.reporterId, issue._id, "Report routed", `${issue.trackingId} was routed to ${department.name}.`);
    }

    await audit(ctx, actor._id, "issue.route_department", "issues", issue._id, {
      departmentId: args.departmentId,
      fromStatus: issue.status,
      toStatus: nextStatus,
    });
  },
});

export const markDuplicate = mutation({
  args: { issueId: v.id("issues"), duplicateOfTrackingId: v.string() },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["department_manager", "administrator"]);
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");
    if (!["reported", "triaged"].includes(issue.status)) {
      throw new ConvexError(`Cannot mark an issue as a duplicate from status ${issue.status}`);
    }

    const trackingId = args.duplicateOfTrackingId.trim().toUpperCase();
    const target = await ctx.db
      .query("issues")
      .withIndex("by_tracking_id", (q) => q.eq("trackingId", trackingId))
      .unique();
    if (!target) throw new ConvexError(`No report found with tracking ID ${trackingId}`);
    if (target._id === issue._id) throw new ConvexError("A report cannot be marked as a duplicate of itself");

    await ctx.db.patch(issue._id, {
      status: "duplicate",
      duplicateOfIssueId: target._id,
      updatedAt: Date.now(),
      version: issue.version + 1,
    });
    await ctx.db.insert("issueEvents", {
      issueId: issue._id,
      status: "duplicate",
      actorId: actor._id,
      note: `Linked as a duplicate of ${trackingId}.`,
      createdAt: Date.now(),
    });

    if (issue.reporterId !== actor._id) {
      await notify(
        ctx,
        issue.reporterId,
        issue._id,
        "Linked as a duplicate",
        `${issue.trackingId} was linked to an existing report (${trackingId}) already being tracked.`,
      );
    }

    await audit(ctx, actor._id, "issue.mark_duplicate", "issues", issue._id, { duplicateOfIssueId: target._id });
  },
});

// ---------------------------------------------------------------------
// False-report handling & trust score
// ---------------------------------------------------------------------

/** A field worker flags a suspected false report — never cancels it themselves; it just enters review. */
export const flagFalseReport = mutation({
  args: { issueId: v.id("issues"), reason: v.string(), evidenceMediaId: v.id("issueMedia") },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["field_worker", "department_manager", "administrator"]);
    if (args.reason.trim().length < 10) {
      throw new ConvexError("Explain why this looks like a false report (at least 10 characters)");
    }
    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");

    await ctx.db.patch(issue._id, {
      falseReportStatus: "under_review",
      falseReportFlaggedBy: actor._id,
      falseReportReason: args.reason.trim(),
      falseReportEvidenceMediaId: args.evidenceMediaId,
      updatedAt: Date.now(),
    });

    await audit(ctx, actor._id, "issue.flag_false_report", "issues", issue._id, { reason: args.reason });
  },
});

/**
 * Administrator-only resolution of a false-report review. Only a confirmed
 * finding touches the reporter's trust score, and it's always an appended,
 * reasoned ledger entry — never a silent field edit. After
 * RESTRICTED_REPORT_THRESHOLD confirmed reports, new-report creation is
 * blocked for 30 days (see issues.create's restrictedUntil check).
 */
export const reviewFalseReport = mutation({
  args: {
    issueId: v.id("issues"),
    decision: v.union(v.literal("confirmed_malicious"), v.literal("dismissed")),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { user: actor } = await requireRole(ctx, ["administrator"]);
    if (args.note.trim().length < 10) throw new ConvexError("A documented reason is required");

    const issue = await ctx.db.get(args.issueId);
    if (!issue || issue.deletedAt) throw new ConvexError("Issue not found");
    if (issue.falseReportStatus !== "under_review") throw new ConvexError("This issue is not under false-report review");

    await ctx.db.patch(issue._id, { falseReportStatus: args.decision, updatedAt: Date.now() });
    await audit(ctx, actor._id, "issue.review_false_report", "issues", issue._id, {
      decision: args.decision,
      note: args.note,
    });

    if (args.decision !== "confirmed_malicious") return;

    const reporter = await ctx.db.get(issue.reporterId);
    if (!reporter) return;

    await ctx.db.insert("trustScoreEvents", {
      userId: reporter._id,
      delta: -20,
      reason: args.note.trim(),
      relatedIssueId: issue._id,
      actorId: actor._id,
      createdAt: Date.now(),
    });
    const newScore = reporter.trustScore - 20;
    await ctx.db.patch(reporter._id, { trustScore: newScore, updatedAt: Date.now() });

    const confirmedCount = (
      await ctx.db
        .query("trustScoreEvents")
        .withIndex("by_user_and_time", (q) => q.eq("userId", reporter._id))
        .collect()
    ).filter((e) => e.delta < 0).length;

    if (confirmedCount >= RESTRICTED_REPORT_THRESHOLD) {
      const restrictedUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await ctx.db.patch(reporter._id, { restrictedUntil });
      await notify(
        ctx,
        reporter._id,
        issue._id,
        "Reporting temporarily restricted",
        `After ${confirmedCount} confirmed false reports, new report creation is paused for 30 days. If you believe this is wrong, contact support to appeal.`,
      );
      await audit(ctx, actor._id, "user.restrict_reporting", "users", reporter._id, { confirmedCount, restrictedUntil });
    }
  },
});
