import type {
  AssignmentStatus,
  Department,
  Issue,
  IssueCategory,
  IssueEvent,
  IssueSeverity,
  IssueStatus,
} from "./types";

/** Staff roles as defined in supabase/migrations/20260829000100_initial_schema.sql's app_role enum. */
export const STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"] as const;

/** Statuses that no longer count against an SLA clock. */
const CLOSED_STATUSES: IssueStatus[] = ["resolved", "rejected", "duplicate"];

export function isOpenStatus(status: IssueStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

/**
 * There is no `due_at` on `issues` — only `departments.sla_hours` and the
 * issue's own `created_at`. This is the same overdue definition used across
 * the dashboard, departments, and analytics pages: an open issue is overdue
 * once its age exceeds its department's SLA window.
 */
export function isOverdue(createdAt: string, slaHours: number, status: IssueStatus): boolean {
  if (!isOpenStatus(status)) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs > slaHours * 60 * 60 * 1000;
}

/** ISO timestamp `slaHours` in the past — usable directly in a `.lt("created_at", ...)` filter. */
export function slaCutoffIso(slaHours: number): string {
  return new Date(Date.now() - slaHours * 60 * 60 * 1000).toISOString();
}

/**
 * Staff-facing masked reporter label. Real profile data (name/email) is
 * intentionally not surfaced here — only a stable, non-reversible fragment of
 * the reporter's user id — to preserve the same privacy posture the mock data
 * implied ("Resident ****42"), even though RLS would technically let staff
 * read the full profile.
 */
export function maskReporter(reporterId: string | null | undefined): string {
  if (!reporterId) return "Resident (reporter unavailable)";
  const suffix = reporterId.replace(/-/g, "").slice(-2).toUpperCase();
  return `Resident ****${suffix}`;
}

interface GeoPoint {
  type?: string;
  coordinates?: [number, number];
}

/** PostGIS `geography(Point)` columns come back from PostgREST as GeoJSON. */
export function extractLatLng(location: unknown): { latitude: number; longitude: number } {
  const point = location as GeoPoint | null;
  if (point && Array.isArray(point.coordinates) && point.coordinates.length === 2) {
    const [lng, lat] = point.coordinates;
    return { latitude: lat, longitude: lng };
  }
  return { latitude: 0, longitude: 0 };
}

export interface IssueRow {
  id: string;
  tracking_id: string;
  category: IssueCategory;
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssueSeverity;
  description: string;
  neighborhood: string | null;
  reporter_id: string | null;
  department_id: string | null;
  duplicate_of_issue_id: string | null;
  location: unknown;
  created_at: string;
  updated_at: string;
  departments?: { id: string; name: string } | null;
}

export function mapIssueRow(row: IssueRow, events: IssueEvent[] = []): Issue {
  const { latitude, longitude } = extractLatLng(row.location);
  return {
    id: row.id,
    trackingId: row.tracking_id,
    category: row.category,
    status: row.status,
    severity: row.severity,
    priority: row.priority,
    description: row.description,
    neighborhood: row.neighborhood ?? "Unknown",
    department: row.departments?.name ?? "Unassigned",
    reporterMasked: maskReporter(row.reporter_id),
    latitude,
    longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events,
    duplicateCandidateId: row.duplicate_of_issue_id ?? undefined,
  };
}

export function mapIssueEventRow(row: {
  id: string;
  status: IssueStatus;
  note: string | null;
  created_at: string;
}): IssueEvent {
  return { id: row.id, status: row.status, note: row.note ?? undefined, createdAt: row.created_at };
}

export function mapDepartmentRow(
  row: { id: string; name: string; categories: IssueCategory[]; sla_hours: number },
  openIssues: number,
  overdueIssues: number,
): Department {
  return {
    id: row.id,
    name: row.name,
    categories: row.categories,
    slaHours: row.sla_hours,
    openIssues,
    overdueIssues,
  };
}

/** `assignments` has no status column — status is read off the parent issue. */
export const ASSIGNMENT_STATUS_BY_ISSUE_STATUS: Partial<Record<IssueStatus, AssignmentStatus>> = {
  assigned: "assigned",
  in_progress: "in_progress",
  pending_verification: "pending_verification",
};

/**
 * Transitions the app permits from each status, per spec/ARCHITECTURE.md's
 * workflow section. RLS (`issues_staff_update`) lets any staff role update
 * any issue row — this table is what keeps the UI from offering nonsensical
 * transitions; it is not enforced by the database itself.
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
