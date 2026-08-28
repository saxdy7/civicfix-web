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

- **Mapbox → MapLibre GL (via MapCN).** The original spec named Mapbox as the map authority. MapCN builds on MapLibre GL and ships free tiles requiring no API key, so the map renders with zero credentials — decisive for demo readiness. MapCN components are copy-paste and ship Tailwind classes; those classes are **stripped and re-implemented as CSS Modules** so the no-Tailwind rule stays intact. Recorded in `spec/ARCHITECTURE.md` and `spec/DESIGN.md`.
- **Dark monochrome design system adopted.** Black background with white ink is the primary palette; civic accent colors are demoted to small status/category signal only. Headings use a retro dot-matrix display face (BubbledotICG-FinePos); Inter carries all UI and body copy. This superseded an earlier white-background system. Full system in `spec/DESIGN.md`.
- **Landing page rebuilt as a video hero.** A full-bleed looping CloudFront MP4 sits behind a locked first viewport (pill nav, trust row, dot-matrix headline, counting stat footer), followed by seven scrolling sections. Motion uses Lenis + GSAP ScrollTrigger.
- **Staff cannot self-register.** Residents self-serve at `/sign-up`; staff request access at `/staff/request-access` and are verified and role-granted by an administrator at `/admin/access-requests`. See the registration section in `spec/DESIGN.md`.

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
