// Used ONLY when EXPO_PUBLIC_CONVEX_URL/EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY are absent (see
// lib/convex-client.ts `isConvexConfigured`). Every repository function checks
// that flag and falls back to these fixtures instead of querying Convex —
// they exist so the app is still explorable with zero configuration, never
// as a silent substitute for a failed real query. components/DemoBanner.tsx
// keeps this visibly labelled wherever it's shown, and tracking IDs are
// prefixed "DEMO-" (never "CF-") so a demo report can't be mistaken for a
// real one.
import type { AppNotification, Assignment, Issue } from "./types";

export const DEMO_ISSUES: Issue[] = [
  {
    id: "demo-iss-1",
    trackingId: "DEMO-10234",
    category: "pothole",
    status: "in_progress",
    severity: "high",
    description: "Deep pothole in the eastbound lane near the intersection, causing cars to swerve.",
    neighborhood: "Maple & 5th",
    latitude: 37.7749,
    longitude: -122.4194,
    createdAt: "2026-08-20T14:12:00Z",
    updatedAt: "2026-08-25T09:00:00Z",
    events: [
      { id: "e1", status: "reported", createdAt: "2026-08-20T14:12:00Z" },
      { id: "e2", status: "triaged", note: "Confirmed via photo, high severity.", createdAt: "2026-08-21T10:00:00Z" },
      { id: "e3", status: "assigned", note: "Routed to Streets & Roads.", createdAt: "2026-08-22T08:30:00Z" },
      { id: "e4", status: "in_progress", createdAt: "2026-08-25T09:00:00Z" },
    ],
  },
  {
    id: "demo-iss-2",
    trackingId: "DEMO-10198",
    category: "garbage",
    status: "pending_verification",
    severity: "medium",
    description: "Overflowing dumpster behind the community center, attracting pests.",
    neighborhood: "Riverside Park",
    latitude: 37.769,
    longitude: -122.4102,
    createdAt: "2026-08-18T11:00:00Z",
    updatedAt: "2026-08-24T16:40:00Z",
    events: [
      { id: "e1", status: "reported", createdAt: "2026-08-18T11:00:00Z" },
      { id: "e2", status: "triaged", createdAt: "2026-08-19T09:00:00Z" },
      { id: "e3", status: "assigned", createdAt: "2026-08-19T15:00:00Z" },
      { id: "e4", status: "in_progress", createdAt: "2026-08-22T09:00:00Z" },
      { id: "e5", status: "pending_verification", note: "Evidence submitted by field worker.", createdAt: "2026-08-24T16:40:00Z" },
    ],
  },
  {
    id: "demo-iss-3",
    trackingId: "DEMO-10256",
    category: "streetlight",
    status: "reported",
    severity: "medium",
    description: "Streetlight has been flickering and going dark most nights this week.",
    neighborhood: "Oak Hill",
    latitude: 37.781,
    longitude: -122.406,
    createdAt: "2026-08-26T20:00:00Z",
    updatedAt: "2026-08-26T20:00:00Z",
    events: [{ id: "e1", status: "reported", createdAt: "2026-08-26T20:00:00Z" }],
  },
];

export const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: "demo-asg-1",
    issueId: "demo-iss-1",
    issueSummary: "Deep pothole near Maple & 5th",
    category: "pothole",
    neighborhood: "Maple & 5th",
    latitude: 37.7749,
    longitude: -122.4194,
    status: "in_progress",
    dueAt: "2026-08-29T18:00:00Z",
    beforePhotoCaptured: true,
    afterPhotoCaptured: false,
  },
  {
    id: "demo-asg-2",
    issueId: "demo-iss-2",
    issueSummary: "Overflowing dumpster at Riverside Park",
    category: "garbage",
    neighborhood: "Riverside Park",
    latitude: 37.769,
    longitude: -122.4102,
    status: "pending_verification",
    dueAt: "2026-08-25T18:00:00Z",
    beforePhotoCaptured: true,
    afterPhotoCaptured: true,
  },
];

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "demo-n1",
    title: "Evidence submitted",
    body: "Your report DEMO-10198 evidence is pending administrator verification.",
    createdAt: "2026-08-24T16:41:00Z",
    read: false,
  },
  {
    id: "demo-n2",
    title: "Work started",
    body: "A crew has started work on your report DEMO-10234.",
    createdAt: "2026-08-25T09:01:00Z",
    read: false,
  },
];
