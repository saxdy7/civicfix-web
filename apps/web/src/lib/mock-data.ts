import type { Assignment, AuditFinding, Department, Issue, StaffUser } from "./types";

export const MOCK_ISSUES: Issue[] = [
  {
    id: "iss-1",
    trackingId: "CF-10234",
    category: "pothole",
    status: "in_progress",
    severity: "high",
    priority: "high",
    description:
      "Deep pothole in the eastbound lane near the intersection, causing cars to swerve into the bike lane.",
    neighborhood: "Maple & 5th",
    department: "Streets & Roads",
    reporterMasked: "Resident ****42",
    latitude: 37.7749,
    longitude: -122.4194,
    createdAt: "2026-08-20T14:12:00Z",
    updatedAt: "2026-08-25T09:00:00Z",
    aiSuggestedCategory: "pothole",
    aiConfidence: 0.94,
    events: [
      { id: "e1", status: "reported", createdAt: "2026-08-20T14:12:00Z" },
      { id: "e2", status: "triaged", note: "Confirmed via photo, high severity.", createdAt: "2026-08-21T10:00:00Z" },
      { id: "e3", status: "assigned", note: "Routed to Streets & Roads.", createdAt: "2026-08-22T08:30:00Z" },
      { id: "e4", status: "in_progress", createdAt: "2026-08-25T09:00:00Z" },
    ],
  },
  {
    id: "iss-2",
    trackingId: "CF-10198",
    category: "garbage",
    status: "pending_verification",
    severity: "medium",
    priority: "medium",
    description: "Overflowing dumpster behind the community center, attracting pests.",
    neighborhood: "Riverside Park",
    department: "Sanitation",
    reporterMasked: "Resident ****17",
    latitude: 37.769,
    longitude: -122.4102,
    createdAt: "2026-08-18T11:00:00Z",
    updatedAt: "2026-08-24T16:40:00Z",
    aiSuggestedCategory: "garbage",
    aiConfidence: 0.88,
    events: [
      { id: "e1", status: "reported", createdAt: "2026-08-18T11:00:00Z" },
      { id: "e2", status: "triaged", createdAt: "2026-08-19T09:00:00Z" },
      { id: "e3", status: "assigned", createdAt: "2026-08-19T15:00:00Z" },
      { id: "e4", status: "in_progress", createdAt: "2026-08-22T09:00:00Z" },
      { id: "e5", status: "pending_verification", note: "Evidence submitted by field worker.", createdAt: "2026-08-24T16:40:00Z" },
    ],
  },
  {
    id: "iss-3",
    trackingId: "CF-10256",
    category: "streetlight",
    status: "reported",
    severity: "medium",
    priority: "medium",
    description: "Streetlight has been flickering and going dark most nights this week.",
    neighborhood: "Oak Hill",
    department: "Utilities",
    reporterMasked: "Resident ****88",
    latitude: 37.781,
    longitude: -122.406,
    createdAt: "2026-08-26T20:00:00Z",
    updatedAt: "2026-08-26T20:00:00Z",
    aiSuggestedCategory: "streetlight",
    aiConfidence: 0.76,
    duplicateCandidateId: "iss-5",
    events: [{ id: "e1", status: "reported", createdAt: "2026-08-26T20:00:00Z" }],
  },
  {
    id: "iss-4",
    trackingId: "CF-10061",
    category: "pothole",
    status: "resolved",
    severity: "low",
    priority: "low",
    description: "Small pothole near the bike lane, patched by crew.",
    neighborhood: "Maple & 5th",
    department: "Streets & Roads",
    reporterMasked: "Resident ****03",
    latitude: 37.7755,
    longitude: -122.418,
    createdAt: "2026-08-02T09:00:00Z",
    updatedAt: "2026-08-10T13:00:00Z",
    events: [
      { id: "e1", status: "reported", createdAt: "2026-08-02T09:00:00Z" },
      { id: "e2", status: "triaged", createdAt: "2026-08-03T09:00:00Z" },
      { id: "e3", status: "assigned", createdAt: "2026-08-04T09:00:00Z" },
      { id: "e4", status: "in_progress", createdAt: "2026-08-08T09:00:00Z" },
      { id: "e5", status: "pending_verification", createdAt: "2026-08-09T09:00:00Z" },
      { id: "e6", status: "resolved", note: "Verified by administrator.", createdAt: "2026-08-10T13:00:00Z" },
    ],
  },
  {
    id: "iss-5",
    trackingId: "CF-10250",
    category: "streetlight",
    status: "triaged",
    severity: "medium",
    priority: "medium",
    description: "Streetlight out at the corner of Oak Hill and 3rd, reported by another resident two days ago.",
    neighborhood: "Oak Hill",
    department: "Utilities",
    reporterMasked: "Resident ****55",
    latitude: 37.7812,
    longitude: -122.4058,
    createdAt: "2026-08-24T18:00:00Z",
    updatedAt: "2026-08-25T09:00:00Z",
    events: [
      { id: "e1", status: "reported", createdAt: "2026-08-24T18:00:00Z" },
      { id: "e2", status: "triaged", createdAt: "2026-08-25T09:00:00Z" },
    ],
  },
];

export const MOCK_DEPARTMENTS: Department[] = [
  { id: "dept-1", name: "Streets & Roads", categories: ["pothole"], slaHours: 72, openIssues: 6, overdueIssues: 1 },
  { id: "dept-2", name: "Sanitation", categories: ["garbage"], slaHours: 48, openIssues: 4, overdueIssues: 0 },
  { id: "dept-3", name: "Utilities", categories: ["streetlight"], slaHours: 96, openIssues: 5, overdueIssues: 2 },
  { id: "dept-4", name: "General Services", categories: ["other"], slaHours: 120, openIssues: 2, overdueIssues: 0 },
];

export const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "asg-1",
    issueId: "iss-1",
    issueTrackingId: "CF-10234",
    issueSummary: "Deep pothole near Maple & 5th",
    category: "pothole",
    worker: "J. Alvarez",
    status: "in_progress",
    dueAt: "2026-08-29T18:00:00Z",
  },
  {
    id: "asg-2",
    issueId: "iss-2",
    issueTrackingId: "CF-10198",
    issueSummary: "Overflowing dumpster at Riverside Park",
    category: "garbage",
    worker: "M. Chen",
    status: "pending_verification",
    dueAt: "2026-08-25T18:00:00Z",
  },
  {
    id: "asg-3",
    issueId: "iss-3",
    issueTrackingId: "CF-10256",
    issueSummary: "Flickering streetlight on Oak Hill",
    category: "streetlight",
    worker: "Unassigned",
    status: "assigned",
    dueAt: "2026-08-31T18:00:00Z",
  },
];

export const MOCK_AUDIT_FINDINGS: AuditFinding[] = [
  {
    id: "af-1",
    title: "2 high-severity issues untriaged past 24h",
    description: "CF-10256 and one other high-severity report have not been triaged within the SLA window.",
    severity: "warning",
    category: "SLA",
  },
  {
    id: "af-2",
    title: "1 resolved issue missing after-photo evidence",
    description: "An issue was marked resolved without a required after-photo on file.",
    severity: "critical",
    category: "Evidence integrity",
  },
  {
    id: "af-3",
    title: "3 undelivered notifications retried and succeeded",
    description: "FCM delivery failures were automatically retried and resolved during this run.",
    severity: "info",
    category: "Notifications",
  },
  {
    id: "af-4",
    title: "Nightly backup completed and restore sample verified",
    description: "Backup and quarterly-scheduled restore sample both completed successfully.",
    severity: "info",
    category: "Backups",
  },
];

export const MOCK_USERS: StaffUser[] = [
  { id: "u-1", name: "Priya Nair", email: "priya@civicfix.city", role: "admin", active: true },
  { id: "u-2", name: "Diego Alvarez", email: "diego@civicfix.city", role: "field_worker", department: "Streets & Roads", active: true },
  { id: "u-3", name: "Mei Chen", email: "mei@civicfix.city", role: "field_worker", department: "Sanitation", active: true },
  { id: "u-4", name: "Sam Okafor", email: "sam@civicfix.city", role: "department_manager", department: "Utilities", active: true },
  { id: "u-5", name: "Ravi Kapoor", email: "ravi@civicfix.city", role: "auditor", active: false },
];

export interface ResidentNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export const MOCK_NOTIFICATIONS: ResidentNotification[] = [
  {
    id: "n1",
    title: "Work started on CF-10234",
    body: "A Streets & Roads crew has begun work on the pothole you reported at Maple & 5th.",
    createdAt: "2026-08-25T09:01:00Z",
    read: false,
  },
  {
    id: "n2",
    title: "Evidence submitted for CF-10198",
    body: "Before/after photos were submitted for the Riverside Park dumpster and are awaiting administrator verification.",
    createdAt: "2026-08-24T16:41:00Z",
    read: false,
  },
  {
    id: "n3",
    title: "CF-10061 resolved",
    body: "The pothole near the bike lane was repaired and the resolution evidence was verified.",
    createdAt: "2026-08-10T13:01:00Z",
    read: true,
  },
];
