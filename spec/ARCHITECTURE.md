# CivicFix Architecture Specification

## Source requirement and purpose

This is the source-of-truth architecture for CivicFix. It preserves Dev Quest Problem #31: citizens report potholes, garbage, streetlight failures, and other civic issues with a photo and GPS pin, and reports are visible on a shared map. CivicFix expands this into an AI-assisted, human-controlled, auditable resolution platform.

## Fixed technology decisions

| Layer | Decision |
|---|---|
| Primary hackathon app | React Native + TypeScript; Expo is recommended for Android/iOS delivery. |
| Website | Next.js + TypeScript for the public map and admin console. |
| Web UI | shadcn/ui with CSS Modules and CSS variables. Tailwind CSS is forbidden. |
| API | Python + FastAPI. |
| Auth, database, storage | One Supabase project: Supabase Auth, PostgreSQL + PostGIS, and Supabase Storage. |
| Maps | MapCN component patterns on MapLibre GL, rendering free OpenStreetMap raster tiles. No map API key required. Tailwind classes shipped by MapCN are stripped and re-implemented as CSS Modules. |
| Motion (web) | Lenis smooth scrolling plus an IntersectionObserver scroll-reveal; both disable under `prefers-reduced-motion` and never leave content hidden without JS. |
| AI | Groq API first; OpenRouter is the approved provider alternative behind an adapter. |
| Notifications | Firebase Cloud Messaging (FCM). |
| Web deployment | Vercel for the Next.js website. |

## System boundaries

The React Native app is the primary citizen and field-worker experience. It owns camera/location permissions, report composition, offline drafts, assignment handling, native push registration, and authenticated calls.

The Next.js website owns the public map, accessible list fallback, public issue detail, and the administrator/auditor console. It is not a second database or competing app.

FastAPI owns protected workflow transitions, role/scope decisions, data validation, AI orchestration, PostGIS business queries, signed-upload issuance, audit-event creation, and background-job orchestration. Clients never make authorization decisions, store AI secrets, or treat their map state as the geospatial source of truth.

## Services

| Service | Responsibility |
|---|---|
| React Native app | Primary hackathon mobile app for citizen reporting and field work. |
| Next.js on Vercel | Public transparency website and staff console. |
| FastAPI | Domain API, authenticated workflow, webhooks, AI adapter. |
| Supabase | Shared Auth, PostgreSQL/PostGIS database, and encrypted object storage. |
| FCM | Push delivery only; notification history remains in PostgreSQL. |
| Job runner | AI analysis, notifications, SLA checks, daily audits, retries, retention, and backup verification. |

## Shared Supabase data model

React Native and Next.js use the same Supabase project URL and publishable key, with each user’s Supabase Auth session. Both consume the same canonical tables. There is no mobile-only or web-only application database.

FastAPI validates the Supabase JWT for protected operations. Row Level Security (RLS) is enabled on every exposed `public` schema table and policies enforce ownership and role scope. Authorization does not rely on user-editable `user_metadata`. Supabase service-role credentials exist only in FastAPI/job-runner secrets, never in either client.

PostgreSQL uses UUID identifiers, UTC timestamps, soft deletes where appropriate, and PostGIS `geography(Point, 4326)` for report locations. Media is stored in Supabase Storage, with a storage key, checksum, and metadata reference in the database.

| Table | Purpose |
|---|---|
| `users`, `roles`, `user_roles` | Profile linked to Supabase Auth identity and scoped RBAC. |
| `departments` | Category coverage, boundary geometry, and SLA policy. |
| `issues` | Core report: reporter, category, description, status, priority, severity, PostGIS point, department, duplicate link, public visibility, version. |
| `issue_media` | Photo/media storage key, type, checksum, capture time, safe metadata. |
| `issue_events` | Immutable lifecycle and override timeline. |
| `assignments` | Field-worker assignment, acceptance, due time, completion. |
| `resolution_evidence` | Before/after proof, note, location, and verification state. |
| `confirmations`, `comments` | Community signal and discussion. |
| `ai_assessments` | Provider, model, structured output, confidence, input hash, prompt version. |
| `notifications`, `device_tokens` | Durable notification state and active FCM device tokens. |
| `audit_logs`, `daily_audit_runs`, `job_runs` | Traceability, audit reports, job idempotency/retries. |

Required indexes include a GIST index on `issues.location`, status/category/priority and department/status indexes, issue-event timeline indexing, and audit entity/time indexing.

Integrity rules: only FastAPI can authorize status transitions; a reporter cannot confirm their own issue; a user has one confirmation kind per issue; a resolved issue requires resolution evidence; AI is advisory and human overrides must be recorded.

## Workflow, APIs, and map flow

Statuses are **reported, triaged, duplicate, assigned, in_progress, pending_verification, resolved, reopened, rejected**. Permitted transitions are: reported to triaged/duplicate/rejected; triaged to assigned/duplicate/rejected; assigned to in_progress/triaged; in_progress to pending_verification/triaged; pending_verification to resolved/reopened; and resolved to reopened. Routing recommends a department from category, severity, municipal boundary, and SLA policy, but a manager approves assignment.

FastAPI exposes versioned REST JSON (`/v1`) with generated OpenAPI. Citizen endpoints cover issues, confirmations, comments, map queries, signed uploads, and notifications. Operations endpoints cover triage, assignments, worker evidence, and admin issue queries. Platform endpoints cover session checks, FCM token registration, health, and webhooks. All mutations require schema validation, JWT/role/scope checks, pagination/rate limits where relevant, and idempotency keys.

After explicit permission, the client submits coordinates and reported accuracy. FastAPI validates bounds and stores the PostGIS point. MapLibre GL renders clustered issues, heatmaps, filters, and selected details using MapCN composition patterns. Backend `ST_DWithin` searches and department polygons power duplicate candidates and routing. Public maps generalize sensitive residential coordinates; staff can see exact locations only when authorized.

Geocoding is not provided by the tile source. When address search or reverse geocoding is required, add a dedicated geocoding provider (Nominatim or equivalent) behind a FastAPI endpoint rather than calling it from a client.

## AI pipeline

On a report with photo and/or text, the system validates file safety, sanitizes metadata, analyzes image/text, proposes category and severity, finds geospatial duplicate candidates, creates a structured summary, then sends the result to human triage. Groq is the initial provider; OpenRouter may replace it through the same provider adapter. Outputs require structured JSON validation, a confidence threshold, prompt/model logging, minimized PII, and a manual-triage fallback. AI can never autonomously reject, close, or assign an issue.

## Notifications and jobs

The API records a durable notification first, then queues FCM delivery for status, assignment, SLA, and verification events. Jobs are idempotent, use exponential-backoff retries, persist `job_runs`, and alert after retry exhaustion. Jobs include AI analysis, duplicate refresh, delivery, media scan, SLA escalation, daily audit, retention purge, and backup verification.

## Daily audit

At 02:00 UTC, a scheduled idempotent job creates an immutable `daily_audit_runs` record and sends an admin summary. It checks referential integrity and illegal lifecycle events; SLA breaches and overdue assignments; missing media/resolution proof; duplicate clusters and untriaged high-severity issues; failed jobs, undelivered notifications, and stale devices; RBAC changes, privileged actions, and audit-log gaps; storage orphans/checksums/signed-URL rules; backups, restore samples, and monitoring alerts.

The run produces findings, creates accountable admin tasks, escalates critical findings, and retains a signed report reference.

## Security, privacy, and observability

Use Supabase Auth as the sole identity provider; FastAPI verifies its JWTs. Require TLS, RLS, least privilege, signed uploads, MIME/size/checksum validation, secret management, a CORS allowlist, rate limits, CSRF protection for cookie flows, dependency scanning, and encrypted storage. Do not expose service-role keys. All privileged reads/exports, role changes, workflow changes, and AI overrides write append-only audit records.

Minimize PII, obtain consented location collection, remove EXIF before public display, restrict contact details by role, and generalize public locations when needed. Collect structured logs with request IDs, metrics, traces, and health checks. Alert on API error budget, job failures, database capacity, backup failure, and suspicious authentication activity. Track submission success, AI latency/fallback, map-query latency, FCM delivery, SLA breaches, resolution time, and audit failures.

## Deployment, lifecycle, and failure handling

The React Native app is built for Android/iOS through Expo-recommended tooling and is the hackathon demo client. Next.js deploys on Vercel with preview deployments and environment-scoped variables. FastAPI/job-runner run as managed services. Supabase hosts shared Auth, PostgreSQL/PostGIS, and Storage. Environments are local, preview, staging, and production; releases require testing, migration review, staging smoke tests, health checks, and a rollback plan.

Retention follows municipality policy and must be configured before production. Use encrypted database backups, point-in-time recovery where available, Supabase Storage versioning, and quarterly restore drills. Soft-delete user content first; authorized irreversible deletion is logged and purges associated media per policy.

If AI is down, save the report as manual-triage-required. If FCM is down, retain/retry the notification and show it in-app. If the map fails, show the list/location-text fallback. If upload fails, keep a local draft and create a final issue only after media validation succeeds.

## Intended repository structure

`apps/mobile` contains the React Native app (`app`, `features`, `components`, `lib`, `services`, `styles`). `apps/web` contains the Next.js application (`app`, `components`, `features`, `lib`, `styles`, `public`). `services/api` contains FastAPI domain, API, service, database, jobs, and tests. `packages/contracts` owns shared API/Supabase/database contracts; `packages/ui-web` owns web UI composition; `infrastructure`, `docs`, and `spec` hold operational material. Implementations must follow this document.
