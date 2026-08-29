# CivicFix specification index

This folder is the source of truth for implementing **CivicFix**, an AI-assisted civic issue reporting and resolution platform. The hackathon's primary product is the React Native mobile app; the website is its shared-data public/admin companion.

The original Dev Quest Problem #31 requirement is retained as the baseline: citizens report civic issues (including potholes, garbage, and streetlights) with a photo and GPS pin, and reports are visible on a shared map. CivicFix expands this into a traceable resolution workflow.

## Read in this order

1. [`spec/ARCHITECTURE.md`](spec/ARCHITECTURE.md) - technology decisions, boundaries, data model, APIs, operations, and deployment.
2. [`spec/DESIGN.md`](spec/DESIGN.md) - product behavior, the visual design system, and screen/UI requirements.
3. [`PROJECT_PROPOSAL.md`](PROJECT_PROPOSAL.md) - problem narrative, delivery plan, demo, and judging case.

## Non-negotiable implementation decisions

- Primary app: React Native + TypeScript (Expo is the recommended runtime) for citizen reporting and field work.
- Website: Next.js + TypeScript + shadcn/ui, with **no Tailwind CSS**. Use CSS Modules and CSS variables.
- Backend: Python + FastAPI.
- Authentication and shared data: Supabase Auth plus the same Supabase PostgreSQL/PostGIS database, used by both React Native and Next.js clients.
- Maps: **MapCN component patterns on MapLibre GL**, using free OpenStreetMap raster tiles. No map API key is required.
- Motion: Lenis for smooth scrolling, plus an IntersectionObserver scroll-reveal. Both must degrade safely (see the motion rules in `spec/DESIGN.md`).
- AI: Groq API initially; OpenRouter is an approved provider alternative.
- Notifications: Firebase Cloud Messaging (FCM).
- Database: PostgreSQL with PostGIS.
- Deployment: Vercel for the Next.js application; FastAPI runs as a managed API service and Supabase hosts the shared authentication/database/storage services.

### Amendment log

- **Mapbox → MapLibre GL (via MapCN).** The original spec named Mapbox as the map authority. MapCN builds on MapLibre GL and ships free tiles requiring no API key, so the map renders with zero credentials — decisive for demo readiness. MapCN components are copy-paste and ship Tailwind classes; those classes are **stripped and re-implemented as CSS Modules** so the no-Tailwind rule stays intact. Recorded in `spec/ARCHITECTURE.md` and `spec/DESIGN.md`. **Reaffirmed 2026-08-29**: a later request asked to revert to Mapbox; the owner explicitly chose to keep MapLibre instead, specifically to avoid reintroducing a paid/rate-limited API-token dependency for the map. Do not re-flag this as a gap — reopen only on an explicit, deliberate request to switch providers. **Requested again 2026-08-29 (web spec, "fixed decisions" list).** The blocker is unchanged and purely practical: no Mapbox access token has been provided. Give a `NEXT_PUBLIC_MAPBOX_TOKEN` / `EXPO_PUBLIC_MAPBOX_TOKEN` and the swap can proceed in a dedicated pass — implementing it without a token would just replace a working zero-credential map with a broken one.
- **Dark monochrome design system adopted.** Black background with white ink is the primary palette; civic accent colors are demoted to small status/category signal only. Headings use a retro dot-matrix display face (BubbledotICG-FinePos); Inter carries all UI and body copy. This superseded an earlier white-background system. Full system in `spec/DESIGN.md`.
- **Landing page rebuilt as a video hero.** A full-bleed looping CloudFront MP4 sits behind a locked first viewport (pill nav, trust row, dot-matrix headline, counting stat footer), followed by seven scrolling sections. Motion uses Lenis + GSAP ScrollTrigger.
- **Staff cannot self-register.** Residents self-serve at `/sign-up`; staff request access at `/staff/request-access` and are verified and role-granted by an administrator at `/admin/access-requests`. See the registration section in `spec/DESIGN.md`.
- **Privileged issue writes moved from direct table updates to audited RPCs (2026-08-29).** The web admin console (`TriagePanel`/`ResolutionPanel`) previously wrote `status`, `severity`, and `department_id` straight to `issues` from the browser via `.update()` — no transition check, no `issue_events` row, no audit record, and (per the RLS policy at the time) any staff role could change any field. Migration `20260829020000_audited_triage_rpcs.sql` adds `update_issue_status`, `route_issue_department`, and `mark_issue_duplicate` (`SECURITY DEFINER`, staff-only, transition-validated, atomically writing the issue update + an `issue_events` row + an `audit_logs` row) and **drops** the old blanket `issues_staff_update` RLS policy, so these RPCs are now the only path to change those fields. This still doesn't move the logic into FastAPI (FastAPI remains an empty health check) — it's the same "narrow, audited Supabase RPC" pattern already used for `assign_worker` and `approve_staff_access_request`, applied to triage/resolution too.
- **"Continue with Google" removed from the website (2026-08-29).** No Google OAuth provider is configured in the Supabase project, so the button was dead — clicking it either errored or (per the design rule "don't show a broken provider button") should never have rendered. Removed from both `/sign-in` and `/sign-up`; a manual show/hide password toggle was added to both forms in its place. Re-add only once Google OAuth is actually configured in Supabase Auth settings.
- **Future state-level municipal tenancy — planning only, not implemented (2026-08-29).** `docs/future/state-level-municipalities/` holds an architecture writeup and a draft (unapplied) migration for scoping issues and staff to a state/city-level "municipal authority" so, e.g., a Punjab authority never sees another state's reports. It intentionally leaves open whether the tenancy unit is one-per-state or one-per-city-municipal-corporation — see that folder's README for why. Do not treat this as built; `issues`/`user_roles` have no `authority_id` column yet.

When a later implementation decision conflicts with these documents, update all three deliberately in the same change.

## Repository layout

```
apps/mobile        React Native + TypeScript (Expo Router) — primary hackathon client
apps/web           Next.js + TypeScript — public map and staff console
services/api       Python + FastAPI — domain API and background jobs
packages/contracts Shared API/database TypeScript contracts
packages/ui-web    Web UI primitives (CSS Modules, no Tailwind)
spec/              ARCHITECTURE.md and DESIGN.md — the source of truth
```

## Running it locally

```bash
# Backend — http://localhost:8000/v1/health
cd services/api
python -m venv .venv && .venv/Scripts/activate     # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Website — http://localhost:3000
npm install                                        # from the repo root (npm workspaces)
cd apps/web && npm run dev

# Mobile — Expo Go, simulator, or emulator
cd apps/mobile && npm install && npm start
```
