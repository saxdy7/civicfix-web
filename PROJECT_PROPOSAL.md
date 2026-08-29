# CivicFix - AI-Powered Civic Issue Resolution Platform

## What we are solving

Dev Quest Problem #31 asks for a map-based civic reporting tool: residents should be able to report potholes, garbage, streetlight failures, and similar issues with a photo and GPS pin, then see reports on a shared map. The usual failure is not reporting - it is the invisible, slow handoff from report to accountable action.

**CivicFix** turns a report into a transparent resolution loop: **report -> AI-assisted triage -> duplicate detection -> department routing -> assignment -> field evidence -> verification -> public status update**. The hackathon demo is led by a React Native mobile app, where reporting and field work naturally happen.

## Why it matters

Residents lack visibility after reporting; departments receive incomplete or duplicate reports; field teams lack a prioritized, geolocated work queue. CivicFix creates a shared operational picture while protecting personal data and retaining human control over decisions.

## Users and value

| User | Value |
|---|---|
| Citizen | Fast photo/GPS report, a tracking ID, status notifications, and visible accountability. |
| Department manager | A triaged queue, duplicate candidates, SLA visibility, and controlled assignment. |
| Field worker | Mobile assignment list, map location, and before/after resolution evidence. |
| Administrator/auditor | Role controls, operational analytics, immutable audit records, and daily audit findings. |

## Feature set

## Product surfaces and shared identity

The primary hackathon product is a **React Native + TypeScript** app (Expo recommended) for citizens and field workers: camera-first reporting, GPS, push notifications, assignment handling, and before/after evidence. The **Next.js + TypeScript** site is deliberately retained for the public live map, resident portal, and the administrator/auditor console. It uses shadcn/ui patterns with CSS Modules and CSS variables - **no Tailwind CSS**.

Both surfaces use **Clerk** for authentication and one shared **Convex** real-time deployment. They read and write the same canonical issue records, media files, notification history, and workflow events. There is no copied “mobile database” or “website database.” Convex validates the Clerk JWT and enforces role-based access control server-side.

### MVP

- Photo, category, description, and GPS/map-pin reporting.
- Shared MapLibre GL issue map (MapCN patterns, free OpenStreetMap tiles, no API key) with clustering, filters, and an accessible list fallback.
- React Native citizen/field-worker flows: camera/GPS reporting, citizen tracking, assignment acceptance, evidence capture, offline drafts, and push notifications.
- Next.js website flows: public issue map, accessible list fallback, resident portal, administrator queue, SLA analytics, and daily-audit console.
- Admin triage, department routing, field-worker assignment, and resolution evidence verification.
- Real-time geospatial duplicate detection and nearby candidate matching.
- Groq-powered structured category, severity, and concise complaint-summary suggestions, always reviewable by staff.
- Daily audit dashboard for integrity, SLA, job, notification, storage, and privileged-access checks.

### Differentiators

- **Trust-aware duplicate detection:** combines radius, category, time, and AI similarity; staff decides whether to merge.
- **Transparent SLA clock:** residents see the next operational stage without exposing sensitive internal data.
- **Before/after verification:** field evidence enters a verification state before an issue becomes resolved.
- **Civic risk heatmap:** aggregates verified issue patterns for preventive planning; it is explicitly a stretch feature, not a substitute for real incident response.
- **Confirmation signal:** nearby residents can confirm an issue without creating noise from duplicate complaints.

## Architecture and data design

The primary React Native + TypeScript app owns native camera, location, offline-draft, and push notification flows. The Next.js + TypeScript website uses shadcn/ui patterns with CSS Modules and CSS variables - **no Tailwind CSS** - for public and staff web experiences. Clerk supplies the identity session to both clients, and Convex is their shared real-time database and document storage. Convex owns every protected business rule, authorization decision, mutation, and audit event. MapLibre GL renders maps using MapCN composition patterns and free OpenStreetMap tiles, so no map credential is required. Groq is the first LLM provider and OpenRouter is an approved adapter alternative. Convex delivers notifications and manages device tokens. The website deploys to Vercel and Convex deploys to its managed cloud.

The core entity is `issues`, which stores category, lifecycle status, priority, department, and coordinates. Related tables preserve media, state events, assignments, resolution evidence, community votes/comments, direct issue messages, AI assessments, notifications, device tokens, trust score events, and immutable audit logs. Convex Storage (`_storage`) holds media files, referenced by checksum and metadata. Full table details are in [`spec/ARCHITECTURE.md`](spec/ARCHITECTURE.md).

## AI and safety

On submission, a backend pipeline validates the file, removes unsafe public metadata, analyzes available photo/text, suggests a structured classification and severity, finds geospatial duplicate candidates, and writes a short structured summary. The output has a confidence score, model/provider and prompt version. Low-confidence or unavailable AI routes to manual triage. AI cannot reject, close, or assign an issue autonomously.

## Daily audit and operations

At 02:00 UTC, an idempotent background job records a `daily_audit_runs` entry and checks status integrity, required resolution evidence, high-severity triage gaps, SLA breaches, duplicate clusters, failed jobs, undelivered notifications, RBAC changes, audit-log gaps, storage consistency, backup completion, and a restore sample. Findings create accountable admin tasks, escalate critical results, and retain a signed report. This makes governance a product feature rather than a slide-deck promise.

## Security and privacy

- Authenticated actions are enforced by FastAPI with scoped RBAC; privileged reads, exports, role changes, state changes, and AI overrides are append-only audit events.
- Uploads use signed URLs, MIME/size/checksum checks, media scanning, encryption, and no database blobs.
- Public maps can generalize sensitive locations; EXIF is removed before public rendering, and reporter contact data is role restricted.
- TLS, least-privilege service accounts, secret management, rate limiting, request tracing, environment separation, backups, and restore drills are required.

## Demo flow (3-5 minutes)

1. A resident photographs a pothole, drops a GPS pin, and submits a report.
2. The system shows an AI-assisted category/severity suggestion and a nearby existing report; the resident confirms rather than duplicating.
3. An administrator sees the merged signal in the live queue, approves routing, and assigns a worker.
4. The worker opens the map assignment, uploads before/after evidence, and submits it for verification.
5. The administrator resolves the case; FCM notifies the resident and the public map/status timeline updates.
6. Finish on the daily audit screen: show an SLA finding or clean audit run as proof of operational accountability.

## Success metrics

- Report submission success rate and median time to report.
- Duplicate reports converted into confirmations.
- Median time: reported -> triaged -> assigned -> resolved.
- SLA compliance and overdue high-severity count.
- FCM delivery success, AI fallback rate, and audit-finding closure time.
- Citizen verification/confirmation participation, tracked without exposing identities.

## Delivery phases

1. **Foundation:** React Native/Next.js contracts, Clerk Auth + Convex schema, RBAC, mobile camera/location permissions, and the MapLibre base map.
2. **Resolution loop:** mobile reporting/uploads, issue map, Next.js admin triage, mobile assignments/evidence, and shared status timeline.
3. **Intelligence and reliability:** Groq adapter, duplicate candidates, FCM, jobs, audit logs, daily audit, metrics.
4. **Polish:** accessibility review, mobile flow, privacy controls, test data, demo script, Vercel release pipeline.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI misclassification | Human approval, confidence threshold, structured validation, manual fallback. |
| Duplicate or malicious reports | Geospatial candidate review, rate limits, confirmation model, moderation controls. |
| Sensitive location exposure | Role-based exact coordinates, public generalization, consent and EXIF removal. |
| Notification/API outage | Durable notification queue, retry/backoff, in-app notification and list/map fallback. |
| Hackathon scope creep | Finish the MVP resolution loop first; heatmaps and predictive routing are stretch goals. |

## Why CivicFix can win

It is instantly understandable, visually demonstrable, and socially grounded. More importantly, it is not a thin “report an issue” interface: it demonstrates a credible operating system for city response, with accountable human decisions, auditable automation, field proof, and measurable service outcomes. That combination gives judges a complete story from a resident’s camera to a verified public result.

## Implementation rule

[`README.md`](README.md), [`spec/ARCHITECTURE.md`](spec/ARCHITECTURE.md), and [`spec/DESIGN.md`](spec/DESIGN.md) are jointly the source of truth. Any implementation must keep the fixed stack, lifecycle vocabulary, no-Tailwind constraint, and security/operations requirements consistent across all three.
