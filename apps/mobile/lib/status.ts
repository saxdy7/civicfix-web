import { color } from "./theme";
import type { IssueStatus } from "./types";

export const STATUS_LABEL: Record<IssueStatus, string> = {
  reported: "Submitted and awaiting review",
  triaged: "Reviewed and being routed",
  duplicate: "Linked to an existing report",
  assigned: "Work assigned",
  in_progress: "Work underway",
  pending_verification: "Evidence submitted for review",
  resolved: "Resolution verified",
  reopened: "More work needed",
  rejected: "Not actionable",
};

export const STATUS_SHORT_LABEL: Record<IssueStatus, string> = {
  reported: "Reported",
  triaged: "Triaged",
  duplicate: "Duplicate",
  assigned: "Assigned",
  in_progress: "In progress",
  pending_verification: "Pending verification",
  resolved: "Resolved",
  reopened: "Reopened",
  rejected: "Rejected",
};

export const STATUS_COLOR: Record<IssueStatus, string> = {
  reported: color.slate600,
  triaged: color.civicBlue,
  duplicate: color.slate600,
  assigned: color.civicBlue,
  in_progress: color.civicAmber,
  pending_verification: color.civicAmber,
  resolved: color.civicGreen,
  reopened: color.civicRed,
  rejected: color.civicRed,
};

export const CATEGORY_LABEL: Record<string, string> = {
  pothole: "Pothole",
  garbage: "Garbage",
  streetlight: "Streetlight",
  other: "Other",
};
