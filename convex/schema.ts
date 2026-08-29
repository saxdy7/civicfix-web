import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// CivicFix Convex schema — the single source of truth for both apps/web and
// apps/mobile.
//
// Identity: every user-owned row stores a Convex `users` document id, never
// a raw Clerk id directly — `users.clerkId` is the one place Clerk's id is
// looked up, via the `by_clerk_id` index, in `getViewer`/`requireUser`
// helpers in convex/lib/auth.ts. This keeps every other table decoupled
// from which auth provider is in front of it.

export default defineSchema({
  // ---------------------------------------------------------------------
  // Identity & roles
  // ---------------------------------------------------------------------
  users: defineTable({
    clerkId: v.string(),
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    // Set only when an approved staff_access_request carries one — lets a
    // field worker or manager sign in with their employee ID instead of
    // typing their email.
    employeeId: v.optional(v.string()),
    trustScore: v.number(), // starts at 100; see trustScoreEvents for the ledger
    restrictedUntil: v.optional(v.number()), // epoch ms; new-report creation blocked until this passes
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_employee_id", ["employeeId"]),

  // A user can hold more than one role at once (e.g. field_worker AND
  // department_manager); "administrator" is never self-granted client-side —
  // every write to this table goes through a server-side-checked mutation.
  userRoles: defineTable({
    userId: v.id("users"),
    role: v.union(
      v.literal("citizen"),
      v.literal("field_worker"),
      v.literal("department_manager"),
      v.literal("administrator"),
      v.literal("auditor"),
    ),
    departmentId: v.optional(v.id("departments")),
    grantedBy: v.optional(v.id("users")),
    grantedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"])
    .index("by_user_and_role", ["userId", "role"]),

  // ---------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------
  departments: defineTable({
    name: v.string(),
    categories: v.array(
      v.union(v.literal("pothole"), v.literal("garbage"), v.literal("streetlight"), v.literal("other")),
    ),
    slaHours: v.number(),
    createdAt: v.number(),
  }),

  // ---------------------------------------------------------------------
  // Core issue workflow
  // ---------------------------------------------------------------------
  issues: defineTable({
    trackingId: v.string(), // server-generated, e.g. "CF-10042" — see mutations/issues.ts
    reporterId: v.id("users"),
    category: v.union(v.literal("pothole"), v.literal("garbage"), v.literal("streetlight"), v.literal("other")),
    description: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    status: v.union(
      v.literal("reported"),
      v.literal("triaged"),
      v.literal("duplicate"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("pending_verification"),
      v.literal("resolved"),
      v.literal("reopened"),
      v.literal("rejected"),
    ),
    departmentId: v.optional(v.id("departments")),
    duplicateOfIssueId: v.optional(v.id("issues")),
    latitude: v.number(),
    longitude: v.number(),
    accuracyM: v.optional(v.number()),
    neighborhood: v.optional(v.string()),
    isPublic: v.boolean(),
    deletedAt: v.optional(v.number()),
    version: v.number(),
    // False-report review — the issue stays visible/active while under
    // review; only a confirmed outcome touches the reporter's trust score.
    falseReportStatus: v.union(
      v.literal("none"),
      v.literal("under_review"),
      v.literal("confirmed_malicious"),
      v.literal("dismissed"),
    ),
    falseReportFlaggedBy: v.optional(v.id("users")),
    falseReportReason: v.optional(v.string()),
    falseReportEvidenceMediaId: v.optional(v.id("issueMedia")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tracking_id", ["trackingId"])
    .index("by_reporter", ["reporterId"])
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_department", ["departmentId"])
    .index("by_department_and_status", ["departmentId", "status"])
    .index("by_status_and_created", ["status", "createdAt"])
    .index("by_public_and_status", ["isPublic", "status"]),

  // Immutable lifecycle timeline — never updated or deleted, only appended.
  issueEvents: defineTable({
    issueId: v.id("issues"),
    status: v.union(
      v.literal("reported"),
      v.literal("triaged"),
      v.literal("duplicate"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("pending_verification"),
      v.literal("resolved"),
      v.literal("reopened"),
      v.literal("rejected"),
    ),
    actorId: v.optional(v.id("users")), // null/absent = system-generated (e.g. community auto-resolve)
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_issue_and_time", ["issueId", "createdAt"]),

  issueMedia: defineTable({
    issueId: v.id("issues"),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    checksum: v.string(),
    uploadedBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_issue", ["issueId"]),

  assignments: defineTable({
    issueId: v.id("issues"),
    workerId: v.id("users"),
    assignedBy: v.id("users"),
    dueAt: v.number(),
    acceptedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_issue", ["issueId"])
    .index("by_worker", ["workerId"])
    .index("by_worker_and_completed", ["workerId", "completedAt"]),

  resolutionEvidence: defineTable({
    issueId: v.id("issues"),
    assignmentId: v.optional(v.id("assignments")),
    beforeMediaId: v.optional(v.id("issueMedia")),
    afterMediaId: v.optional(v.id("issueMedia")),
    note: v.optional(v.string()),
    submittedBy: v.id("users"),
    submittedAt: v.number(),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_issue", ["issueId"])
    .index("by_issue_and_submitted", ["issueId", "submittedAt"]),

  // ---------------------------------------------------------------------
  // Community verification
  // ---------------------------------------------------------------------
  communityVotes: defineTable({
    issueId: v.id("issues"),
    userId: v.id("users"),
    vote: v.union(v.literal("completed"), v.literal("needs_work")),
    comment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_issue", ["issueId"])
    .index("by_issue_and_user", ["issueId", "userId"])
    .index("by_user", ["userId"]),

  communityComments: defineTable({
    issueId: v.id("issues"),
    userId: v.id("users"),
    body: v.string(),
    flaggedAt: v.optional(v.number()),
    flaggedBy: v.optional(v.id("users")),
    flagReason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_issue_and_time", ["issueId", "createdAt"]),

  // ---------------------------------------------------------------------
  // Real-time chat
  // ---------------------------------------------------------------------
  issueMessages: defineTable({
    issueId: v.id("issues"),
    senderId: v.id("users"),
    senderRole: v.union(v.literal("resident"), v.literal("staff")),
    body: v.string(),
    deliveredAt: v.number(),
    readAt: v.optional(v.number()),
    flaggedAt: v.optional(v.number()),
    flaggedBy: v.optional(v.id("users")),
    flagReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_issue_and_time", ["issueId", "createdAt"])
    .index("by_issue_and_read", ["issueId", "readAt"]),

  // ---------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------
  notifications: defineTable({
    userId: v.id("users"),
    issueId: v.optional(v.id("issues")),
    title: v.string(),
    body: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_and_created", ["userId", "createdAt"])
    .index("by_user_and_read", ["userId", "readAt"]),

  deviceTokens: defineTable({
    userId: v.id("users"),
    fcmToken: v.string(),
    platform: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["fcmToken"]),

  // ---------------------------------------------------------------------
  // AI, trust score, audit, jobs
  // ---------------------------------------------------------------------
  aiAssessments: defineTable({
    issueId: v.id("issues"),
    provider: v.string(),
    model: v.string(),
    promptVersion: v.string(),
    inputHash: v.string(),
    output: v.any(),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_issue", ["issueId"]),

  // Append-only ledger backing `users.trustScore` — every confirmed
  // false-report finding (and any other trust-affecting decision) is a row
  // here with its reason, never a silent field mutation.
  trustScoreEvents: defineTable({
    userId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
    relatedIssueId: v.optional(v.id("issues")),
    actorId: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_user_and_time", ["userId", "createdAt"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_time", ["createdAt"])
    .index("by_actor_and_time", ["actorId", "createdAt"]),

  dailyAuditRuns: defineTable({
    runAt: v.number(),
    statusIntegrityPassed: v.boolean(),
    slaBreachesCount: v.number(),
    missingEvidenceCount: v.number(),
    duplicateClustersCount: v.number(),
    unresolvedCriticalCount: v.number(),
    findings: v.array(
      v.object({
        category: v.string(),
        severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
        title: v.string(),
        description: v.string(),
        entityType: v.optional(v.string()),
        entityId: v.optional(v.string()),
      }),
    ),
  }).index("by_run_time", ["runAt"]),

  jobRuns: defineTable({
    jobName: v.string(),
    idempotencyKey: v.string(),
    status: v.union(v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_job_and_time", ["jobName", "startedAt"]),

  // ---------------------------------------------------------------------
  // Staff access requests
  // ---------------------------------------------------------------------
  staffAccessRequests: defineTable({
    userId: v.optional(v.id("users")),
    fullName: v.string(),
    workEmail: v.string(),
    employeeId: v.string(),
    departmentId: v.optional(v.id("departments")),
    requestedRole: v.union(v.literal("field_worker"), v.literal("department_manager")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    termsAcceptedAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),
});
