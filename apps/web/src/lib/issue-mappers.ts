import type { Doc } from "@convex/_generated/dataModel";

import type { Issue, IssueEvent } from "./types";

/** Never expose a raw reporter id to the client. */
export function maskReporter(reporterId: string | null | undefined): string {
  if (!reporterId) return "Resident";
  return `Resident ****${reporterId.slice(-4)}`;
}

function mapEvent(event: Doc<"issueEvents">): IssueEvent {
  return {
    id: event._id,
    status: event.status,
    note: event.note,
    createdAt: new Date(event.createdAt).toISOString(),
  };
}

/** Maps a Convex `issues` document (plus its optionally-resolved department name and event timeline) to the shared `Issue` view type. */
export function mapConvexIssue(
  issue: Doc<"issues">,
  opts: { departmentName?: string | null; events?: Doc<"issueEvents">[] } = {},
): Issue {
  return {
    id: issue._id,
    trackingId: issue.trackingId,
    category: issue.category,
    status: issue.status,
    severity: issue.severity,
    priority: issue.priority,
    description: issue.description,
    neighborhood: issue.neighborhood ?? "Unspecified",
    department: opts.departmentName ?? "Unassigned",
    reporterMasked: maskReporter(issue.reporterId),
    latitude: issue.latitude,
    longitude: issue.longitude,
    createdAt: new Date(issue.createdAt).toISOString(),
    updatedAt: new Date(issue.updatedAt).toISOString(),
    events: (opts.events ?? []).map(mapEvent).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    duplicateCandidateId: issue.duplicateOfIssueId,
  };
}
