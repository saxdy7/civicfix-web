import type { AssignmentStatus, IssueStatus } from "./types";

export const STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"] as const;

/** Statuses that no longer count against an SLA clock. */
const CLOSED_STATUSES: IssueStatus[] = ["resolved", "rejected", "duplicate"];

export function isOpenStatus(status: IssueStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

/**
 * There is no `dueAt` on `issues` itself — only `departments.slaHours` and
 * the issue's own `createdAt`. An open issue is overdue once its age
 * exceeds its department's SLA window.
 */
export function isOverdue(createdAt: number | string, slaHours: number, status: IssueStatus): boolean {
  if (!isOpenStatus(status)) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs > slaHours * 60 * 60 * 1000;
}

/** Staff-facing masked reporter label — a stable, non-reversible fragment of the reporter's Convex id. */
export function maskReporter(reporterId: string | null | undefined): string {
  if (!reporterId) return "Resident (reporter unavailable)";
  return `Resident ****${reporterId.slice(-2).toUpperCase()}`;
}

/** `assignments` has no status column — status is read off the parent issue. */
export const ASSIGNMENT_STATUS_BY_ISSUE_STATUS: Partial<Record<IssueStatus, AssignmentStatus>> = {
  assigned: "assigned",
  in_progress: "in_progress",
  pending_verification: "pending_verification",
};

/**
 * Transitions the app permits from each status, per spec/ARCHITECTURE.md's
 * workflow section — mirrors convex/issues.ts's ALLOWED_TRANSITIONS, which
 * is the version actually enforced server-side. This copy is what keeps the
 * UI from even offering a nonsensical transition.
 */
export const ALLOWED_NEXT_STATUS: Record<IssueStatus, IssueStatus[]> = {
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
