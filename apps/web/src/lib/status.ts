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

export const STATUS_TONE: Record<IssueStatus, "info" | "success" | "warning" | "danger"> = {
  reported: "info",
  triaged: "info",
  duplicate: "info",
  assigned: "info",
  in_progress: "warning",
  pending_verification: "warning",
  resolved: "success",
  reopened: "danger",
  rejected: "danger",
};

export const CATEGORY_LABEL: Record<string, string> = {
  pothole: "Pothole",
  garbage: "Garbage",
  streetlight: "Streetlight",
  other: "Other",
};

export const SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
