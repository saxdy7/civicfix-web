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
  priority: IssueSeverity;
  description: string;
  neighborhood: string;
  department: string;
  reporterMasked: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
  events: IssueEvent[];
  duplicateCandidateId?: string;
  aiSuggestedCategory?: IssueCategory;
  aiConfidence?: number;
}

export interface Department {
  id: string;
  name: string;
  categories: IssueCategory[];
  slaHours: number;
  openIssues: number;
  overdueIssues: number;
}

export type AssignmentStatus = "assigned" | "in_progress" | "pending_verification";

export interface Assignment {
  id: string;
  issueId: string;
  issueTrackingId: string;
  issueSummary: string;
  category: IssueCategory;
  worker: string;
  status: AssignmentStatus;
  dueAt: string;
}

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditFinding {
  id: string;
  title: string;
  description: string;
  severity: AuditSeverity;
  category: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "department_manager" | "field_worker" | "auditor";
  department?: string;
  active: boolean;
}
