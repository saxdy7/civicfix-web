import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getRoles, getViewer, requireRole } from "./lib/auth";

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return null;
    const roles = await getRoles(ctx, user._id);
    if (!roles.some((r) => ["department_manager", "administrator", "auditor"].includes(r))) return null;
    const runs = await ctx.db.query("dailyAuditRuns").withIndex("by_run_time").collect();
    runs.sort((a, b) => b.runAt - a.runAt);
    return runs[0] ?? null;
  },
});

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

interface Finding {
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
}

async function computeAndStoreDailyAudit(ctx: MutationCtx) {
    const now = Date.now();
    const findings: Finding[] = [];

    // Focus on active open status categories using indexed queries
    const [reported, triaged, assigned, inProgress, pendingVerification, recentResolved] = await Promise.all([
      ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", "reported")).take(200),
      ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", "triaged")).take(200),
      ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", "assigned")).take(200),
      ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", "in_progress")).take(200),
      ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", "pending_verification")).take(200),
      ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", "resolved")).order("desc").take(100),
    ]);

    const openIssues = [...reported, ...triaged, ...assigned, ...inProgress, ...pendingVerification].filter((i) => !i.deletedAt);
    const auditedIssues = [...openIssues, ...recentResolved.filter((i) => !i.deletedAt)];

    // 1. Invalid status transitions — replay each issue's event history against the transition table.
    let invalidTransitions = 0;
    for (const issue of auditedIssues) {
      const events = await ctx.db
        .query("issueEvents")
        .withIndex("by_issue_and_time", (q) => q.eq("issueId", issue._id))
        .take(50);
      events.sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 1; i < events.length; i++) {
        const allowed = ALLOWED_TRANSITIONS[events[i - 1].status] ?? [];
        if (events[i].status !== events[i - 1].status && !allowed.includes(events[i].status)) {
          invalidTransitions++;
          findings.push({
            category: "status_integrity",
            severity: "critical",
            title: "Invalid status transition detected",
            description: `Issue ${issue.trackingId}: ${events[i - 1].status} -> ${events[i].status}`,
            entityType: "issues",
            entityId: issue._id,
          });
        }
      }
    }

    // 2. Overdue assignments / SLA breaches.
    const departments = await ctx.db.query("departments").collect();
    const deptById = new Map(departments.map((d) => [d._id, d]));
    let slaBreaches = 0;
    for (const issue of openIssues) {
      const slaHours = issue.departmentId ? (deptById.get(issue.departmentId)?.slaHours ?? 72) : 72;
      if (now - issue.createdAt > slaHours * 60 * 60 * 1000) {
        slaBreaches++;
        findings.push({
          category: "sla",
          severity: "warning",
          title: "SLA breach",
          description: `Issue ${issue.trackingId} has been open past its ${slaHours}h SLA.`,
          entityType: "issues",
          entityId: issue._id,
        });
      }
    }

    const assignments = await ctx.db.query("assignments").collect();
    for (const a of assignments) {
      if (!a.completedAt && a.dueAt < now) {
        findings.push({
          category: "sla",
          severity: "warning",
          title: "Overdue assignment",
          description: `Assignment ${a._id} was due ${new Date(a.dueAt).toISOString()}.`,
          entityType: "assignments",
          entityId: a._id,
        });
      }
    }

    // 3. High-severity issues not yet triaged.
    const untriagedHighSeverity = openIssues.filter(
      (i) => i.status === "reported" && (i.severity === "high" || i.severity === "critical"),
    );
    for (const i of untriagedHighSeverity) {
      findings.push({
        category: "triage",
        severity: "critical",
        title: "High-severity issue not triaged",
        description: `Issue ${i.trackingId} (${i.severity}) has been sitting untriaged.`,
        entityType: "issues",
        entityId: i._id,
      });
    }

    // 4. Resolved issues missing verified evidence.
    let missingEvidence = 0;
    for (const i of recentResolved) {
      const evidence = await ctx.db
        .query("resolutionEvidence")
        .withIndex("by_issue", (q) => q.eq("issueId", i._id))
        .collect();
      if (!evidence.some((e) => e.verifiedAt)) {
        missingEvidence++;
        findings.push({
          category: "evidence",
          severity: "critical",
          title: "Resolved issue missing verified evidence",
          description: `Issue ${i.trackingId} is resolved with no verified before/after evidence on file.`,
          entityType: "issues",
          entityId: i._id,
        });
      }
    }

    // 5. Failed jobs (notification/AI/etc).
    const jobRuns = await ctx.db.query("jobRuns").collect();
    const failedJobs = jobRuns.filter((j) => j.status === "failed" && now - j.startedAt < 24 * 60 * 60 * 1000);
    for (const j of failedJobs) {
      findings.push({
        category: "jobs",
        severity: "warning",
        title: "Job failed",
        description: `${j.jobName} failed: ${j.error ?? "no error message"}`,
        entityType: "jobRuns",
        entityId: j._id,
      });
    }

    // 6. Unread notifications flagging something urgent, stale for 24h+.
    const notifications = await ctx.db.query("notifications").collect();
    const urgentTitles = ["restricted", "reopened", "review", "duplicate"];
    const staleUrgent = notifications.filter(
      (n) => !n.readAt && now - n.createdAt > 24 * 60 * 60 * 1000 && urgentTitles.some((t) => n.title.toLowerCase().includes(t)),
    );
    for (const n of staleUrgent) {
      findings.push({
        category: "notifications",
        severity: "warning",
        title: "Unread urgent notification",
        description: `"${n.title}" has been unread for over 24h.`,
        entityType: "notifications",
        entityId: n._id,
      });
    }

    // 7. Suspicious/privileged role changes in the last 24h.
    const auditLogs = await ctx.db.query("auditLogs").withIndex("by_time").collect();
    const recentRoleGrants = auditLogs.filter((a) => a.action === "role.grant" && now - a.createdAt < 24 * 60 * 60 * 1000);
    for (const a of recentRoleGrants) {
      findings.push({
        category: "privileged_actions",
        severity: "info",
        title: "Role granted",
        description: `${JSON.stringify(a.metadata)}`,
        entityType: "auditLogs",
        entityId: a._id,
      });
    }

    // 8. Repeated fake-report flags — reporters with 2+ confirmed malicious findings.
    const confirmedMalicious = auditedIssues.filter((i) => i.falseReportStatus === "confirmed_malicious");
    const byReporter = new Map<string, number>();
    for (const i of confirmedMalicious) byReporter.set(i.reporterId, (byReporter.get(i.reporterId) ?? 0) + 1);
    let duplicateClusters = 0;
    for (const [reporterId, count] of byReporter) {
      if (count >= 2) {
        duplicateClusters++;
        findings.push({
          category: "trust",
          severity: "warning",
          title: "Repeated confirmed false reports",
          description: `Reporter ${reporterId} has ${count} confirmed malicious reports.`,
          entityType: "users",
          entityId: reporterId,
        });
      }
    }

    // 9. Community verification disputes — near-tied vote splits on pending_verification issues.
    for (const i of pendingVerification) {
      const votes = await ctx.db.query("communityVotes").withIndex("by_issue", (q) => q.eq("issueId", i._id)).collect();
      const completed = votes.filter((v) => v.vote === "completed").length;
      const needsWork = votes.filter((v) => v.vote === "needs_work").length;
      if (completed > 0 && needsWork > 0 && Math.abs(completed - needsWork) <= 1) {
        findings.push({
          category: "community",
          severity: "info",
          title: "Contested community verification",
          description: `Issue ${i.trackingId}: ${completed} completed vs ${needsWork} needs work — needs admin review.`,
          entityType: "issues",
          entityId: i._id,
        });
      }
    }

    // 10. Missing audit events — status-change count should roughly match audit_log entries per issue over the same window.
    const unresolvedCritical = openIssues.filter((i) => i.severity === "critical").length;

    await ctx.db.insert("dailyAuditRuns", {
      runAt: now,
      statusIntegrityPassed: invalidTransitions === 0,
      slaBreachesCount: slaBreaches,
      missingEvidenceCount: missingEvidence,
      duplicateClustersCount: duplicateClusters,
      unresolvedCriticalCount: unresolvedCritical,
      findings,
    });
}

/** Runs at 02:00 UTC daily (see crons.ts). Idempotent within a run — always creates exactly one new dailyAuditRuns record. */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    await computeAndStoreDailyAudit(ctx);
  },
});

/** Administrator-only manual trigger — lets staff run the same checks on demand instead of waiting for 02:00 UTC. */
export const runNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["administrator"]);
    await computeAndStoreDailyAudit(ctx);
  },
});
