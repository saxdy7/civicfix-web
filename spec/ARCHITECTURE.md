# CivicFix Architecture Specification

## Source requirement and purpose

This is the source-of-truth architecture for CivicFix. It preserves Dev Quest Problem #31: citizens report potholes, garbage, streetlight failures, and other civic issues with a photo and GPS pin, and reports are visible on a shared map. CivicFix expands this into an AI-assisted, human-controlled, auditable resolution platform.

## Fixed technology decisions

| Layer | Decision |
|---|---|
| Primary hackathon app | React Native + TypeScript; Expo is recommended for Android/iOS delivery. |
| Website | Next.js + TypeScript for the public map, resident portal, and admin console. |
| Web UI | shadcn/ui patterns with CSS Modules and CSS variables. Tailwind CSS is forbidden. |
| Auth | Clerk (with `@clerk/nextjs` on web and `@clerk/clerk-expo` on mobile). |
| Real-time database & storage | Convex (reactive document store, typed mutations/queries, built-in file storage, and scheduled crons). |
| Backend & APIs | Convex TypeScript functions + optional Python/FastAPI service. |
| Maps | MapCN component patterns on MapLibre GL / Mapbox, rendering raster/vector tiles. Free raster tiles require no API key. |
| Motion (web) | Lenis smooth scrolling plus GSAP ScrollTrigger / IntersectionObserver scroll-reveal; both disable under `prefers-reduced-motion` and never leave content hidden without JS. |
| AI | Groq API first (Llama 3.1 & Vision); OpenRouter is the approved provider alternative behind an adapter. |
| Notifications | Firebase Cloud Messaging (FCM) & Expo Push Service via Convex actions. |
| Web deployment | Vercel for the Next.js website; Convex Cloud for database & storage. |

## System boundaries

The React Native app is the primary citizen and field-worker experience. It owns camera/location permissions, report composition, offline drafts, assignment handling, native push registration, and authenticated calls.

The Next.js website owns the public map, accessible list fallback, public issue detail, resident portal, and the administrator/auditor console. It is not a second database or competing app.

Convex owns protected workflow transitions, role/scope decisions, data validation, audit-event creation, file storage, and background-job/cron orchestration. Clients never make authorization decisions, store AI secrets, or treat their map state as the geospatial source of truth.

## Services

| Service | Responsibility |
|---|---|
| React Native app | Primary hackathon mobile app for citizen reporting and field work. |
| Next.js on Vercel | Public transparency website, resident portal, and staff console. |
| Convex | Real-time reactive data, Auth integration (Clerk JWT validation), file storage, and scheduled cron jobs. |
| FastAPI | Optional Python domain API and background processing adapter. |
| FCM / Expo Push | Push delivery only; notification history remains in Convex. |

## Shared Convex data model

React Native and Next.js connect to the same Convex deployment and Clerk authentication instance. Both consume the same canonical tables. There is no mobile-only or web-only application database.

Convex validates the Clerk JWT for protected operations via `convex/lib/auth.ts`. Document authorization checks verify ownership and role scope from the `userRoles` table. Authorization does not rely on user-editable client metadata.

Locations are stored as latitude and longitude numbers with optional accuracy in meters. Media is stored in Convex Storage (`_storage`), with a storage id, checksum, mime type, and metadata reference in `issueMedia`.

| Table | Purpose |
|---|---|
| `users`, `userRoles` | Profile linked to Clerk identity and scoped RBAC (`citizen`, `field_worker`, `department_manager`, `administrator`, `auditor`). |
| `departments` | Category coverage, SLA policy in hours. |
| `issues` | Core report: reporter, category, description, status, priority, severity, coordinates, department, duplicate link, public visibility, false report state, version. |
| `issueMedia` | Photo/media storage ID, type, checksum, capture time. |
| `issueEvents` | Immutable lifecycle and override timeline. |
| `assignments` | Field-worker assignment, acceptance, due time, completion. |
| `resolutionEvidence` | Before/after proof, note, verification state. |
| `communityVotes`, `communityComments` | Community resolution voting and discussion. |
| `issueMessages` | Real-time direct messaging between residents and city staff. |
| `aiAssessments` | Provider, model, structured output, confidence, input hash, prompt version. |
| `notifications`, `deviceTokens` | Durable notification state and active FCM/Expo device tokens. |
| `trustScoreEvents` | Append-only ledger backing user trust scores and restriction history. |
| `auditLogs`, `dailyAuditRuns`, `jobRuns` | Traceability, audit reports, job idempotency/retries. |
| `staffAccessRequests` | Staff access application, verification, and approval flow. |

Integrity rules: only verified roles can authorize status transitions; a reporter cannot vote on their own issue; a resolved issue requires verified resolution evidence; AI is advisory and human overrides are recorded in audit logs.

## Workflow, APIs, and map flow

Statuses are **reported, triaged, duplicate, assigned, in_progress, pending_verification, resolved, reopened, rejected**. Permitted transitions are: reported to triaged/duplicate/rejected; triaged to assigned/duplicate/rejected; assigned to in_progress/triaged; in_progress to pending_verification/triaged; pending_verification to resolved/reopened; and resolved to reopened. Routing recommends a department from category, severity, municipal boundary, and SLA policy, but a manager approves assignment.

Client endpoints and mutations cover issues, confirmations, comments, chat, map queries, file uploads, and notifications. All mutations require schema validation, Clerk JWT/role/scope checks, and idempotency where relevant.

After explicit permission, the client submits coordinates and reported accuracy. MapLibre GL renders clustered issues, heatmaps, filters, and selected details using MapCN composition patterns. Backend Haversine distance calculations and department routing power duplicate candidates. Public maps generalize sensitive residential coordinates; staff can see exact locations when authorized.

## AI pipeline

On a report with photo and/or text, the system validates file safety, sanitizes metadata, analyzes image/text (via Groq Llama 3.1 & Vision with fallback), proposes category and severity, finds geospatial duplicate candidates, creates a structured summary, then sends the result to human triage. Outputs require structured JSON validation, a confidence threshold, prompt/model logging, and a manual-triage fallback. AI can never autonomously reject, close, or assign an issue.

## Notifications and jobs

The platform records a durable notification in Convex first, then triggers push delivery for status, assignment, SLA, and verification events. Convex cron jobs run idempotent tasks including the 02:00 UTC daily audit.

## Daily audit

At 02:00 UTC, a scheduled idempotent job (`convex/crons.ts` -> `convex/dailyAudit.ts`) creates an immutable `dailyAuditRuns` record and makes findings available to administrators. It checks referential integrity and illegal lifecycle events; SLA breaches and overdue assignments; missing media/resolution proof; duplicate clusters and untriaged high-severity issues; failed jobs, undelivered notifications, and stale devices; RBAC changes, privileged actions, and audit-log gaps.

## Security, privacy, and observability

Use Clerk as the identity provider; Convex verifies its JWTs. Require TLS, least privilege, validated uploads, MIME/size/checksum validation, secret management, rate limits, and encrypted storage. All privileged reads/exports, role changes, workflow changes, and AI overrides write append-only audit records.

## Deployment, lifecycle, and failure handling

The React Native app is built for Android/iOS through Expo-recommended tooling. Next.js deploys on Vercel with preview deployments and environment-scoped variables. Convex hosts the real-time database, auth bridge, and file storage.

If AI is down, save the report as manual-triage-required. If push is down, retain the notification and show it in-app. If the map fails, show the list/location-text fallback.

## Intended repository structure

`apps/mobile` contains the React Native app (`app`, `components`, `lib`). `apps/web` contains the Next.js application (`app`, `components`, `lib`, `public`). `convex` contains the Convex schema, queries, mutations, actions, and scheduled jobs. `services/api` contains optional FastAPI services and tests. `packages/contracts` owns shared contracts; `packages/ui-web` owns web UI composition; `docs` and `spec` hold specification and architectural documentation.
