// Mirrors packages/contracts/issue.ts. Kept local so Metro doesn't need
// cross-workspace resolution for this hackathon skeleton.
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

export interface IssueEvent {
  id: string;
  status: IssueStatus;
  note?: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  trackingId: string;
  category: IssueCategory;
  status: IssueStatus;
  severity: IssueSeverity;
  description: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
  events: IssueEvent[];
  /** Present on nearby/public listings; absent (undefined) elsewhere. */
  reporterId?: string;
}

export type AssignmentStatus = "assigned" | "in_progress" | "pending_verification" | "resolved";

export interface Assignment {
  id: string;
  issueId: string;
  issueSummary: string;
  category: IssueCategory;
  neighborhood: string;
  latitude: number;
  longitude: number;
  status: AssignmentStatus;
  dueAt: string;
  beforePhotoCaptured: boolean;
  afterPhotoCaptured: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface DraftReport {
  id: string;
  category: IssueCategory | null;
  description: string;
  synced: boolean;
  createdAt: string;
}
