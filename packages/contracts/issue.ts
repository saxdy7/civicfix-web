export type IssueStatus =
  | "reported"
  | "triaged"
  | "duplicate"
  | "assigned"
  | "in_progress"
  | "pending_verification"
  | "resolved"
  | "reopened"
  | "rejected";

export type IssueCategory = "pothole" | "garbage" | "streetlight" | "other";

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export interface IssueLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface Issue {
  id: string;
  reporterId: string;
  category: IssueCategory;
  status: IssueStatus;
  priority: IssueSeverity;
  severity: IssueSeverity;
  description: string;
  location: IssueLocation;
  departmentId?: string;
  duplicateOfIssueId?: string;
  isPubliclyVisible: boolean;
  createdAt: string;
  updatedAt: string;
}
