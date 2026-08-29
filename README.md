# CivicFix specification index

This folder is the source of truth for implementing **CivicFix**, an AI-assisted civic issue reporting and resolution platform. The hackathon's primary product is the React Native mobile app; the website is its shared-data public/admin companion.

The original Dev Quest Problem #31 requirement is retained as the baseline: citizens report civic issues (including potholes, garbage, and streetlights) with a photo and GPS pin, and reports are visible on a shared map. CivicFix expands this into a traceable resolution workflow.

## Read in this order

1. [`spec/ARCHITECTURE.md`](spec/ARCHITECTURE.md) - technology decisions, boundaries, data model, APIs, operations, and deployment.
2. [`spec/DESIGN.md`](spec/DESIGN.md) - product behavior, the visual design system, and screen/UI requirements.
3. [`PROJECT_PROPOSAL.md`](PROJECT_PROPOSAL.md) - problem narrative, delivery plan, demo, and judging case.

## Non-negotiable implementation decisions

- Primary app: React Native + TypeScript (Expo is the recommended runtime) for citizen reporting and field work.
- Website: Next.js + TypeScript + shadcn/ui patterns, with **no Tailwind CSS**. Use CSS Modules and CSS variables.
- Authentication: Clerk (with `@clerk/nextjs` on web and `@clerk/clerk-expo` on mobile).
- Real-time database & storage: Convex (reactive documents, ACID mutations, file storage, and scheduled cron jobs).
- Backend: Convex TypeScript functions + optional Python/FastAPI service.
- Maps: **MapCN component patterns on MapLibre GL / Mapbox**, with free raster tiles fallback.
- Motion: Lenis for smooth scrolling, plus GSAP/IntersectionObserver scroll-reveal. Both must degrade safely (see `spec/DESIGN.md`).
- AI: Groq API with vision/text analysis and heuristic fallback; OpenRouter as an alternative provider.
- Notifications: Firebase Cloud Messaging (FCM) & Expo Push Service via Convex actions.
- Deployment: Vercel for the Next.js application, Convex Cloud for real-time backend/storage.

### Amendment log

- **Supabase → Clerk + Convex Migration (2026-08-29).** Replaced Supabase PostgreSQL/PostGIS/Auth with Clerk for identity management and Convex for real-time reactive data, mutations, document storage, and scheduled jobs. All tables, security policies, transactions, and audit trails now run through typed Convex queries, mutations, and actions in `convex/`.
- **Mapbox → MapLibre GL (via MapCN).** MapCN builds on MapLibre GL and ships free tiles requiring no API key, so the map renders with zero credentials — decisive for demo readiness. MapCN components are styled as CSS Modules so the no-Tailwind rule stays intact.
- **Dark monochrome design system adopted.** Black background with white ink is the primary palette; civic accent colors are reserved for small status/category signals only. Headings use a retro dot-matrix display face (BubbledotICG-FinePos); Inter carries all UI and body copy.
- **Landing page rebuilt as a video hero.** A full-bleed looping CloudFront MP4 sits behind a locked first viewport (pill nav, trust row, dot-matrix headline, counting stat footer), followed by seven scrolling sections. Motion uses Lenis + GSAP ScrollTrigger.
- **Staff cannot self-register.** Residents self-serve at `/sign-up`; staff request access at `/staff/request-access` and are verified and role-granted by an administrator at `/admin/access-requests`.

When a later implementation decision conflicts with these documents, update all three deliberately in the same change.

## Repository layout

```
apps/mobile        React Native + TypeScript (Expo Router) — primary hackathon client
apps/web           Next.js + TypeScript — public map, resident portal, and staff console
convex/            Convex schema, queries, mutations, actions, and scheduled cron jobs
services/api       Python + FastAPI — optional domain API
packages/contracts Shared TypeScript contracts
packages/ui-web    Web UI primitives (CSS Modules, no Tailwind)
spec/              ARCHITECTURE.md and DESIGN.md — the source of truth
```

## Running it locally

```bash
# 1. Start Convex real-time backend (from repo root)
npm install
npx convex dev

# 2. Website — http://localhost:3000
cd apps/web && npm run dev

# 3. Mobile — Expo Go, simulator, or emulator
cd apps/mobile && npm install && npm start

# 4. Optional FastAPI service — http://localhost:8000/v1/health
cd services/api
python -m venv .venv && .venv/Scripts/activate     # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```
