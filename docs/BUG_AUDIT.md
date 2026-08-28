# CivicFix — Full Project Audit (2026-08-29)

Scope: apps/mobile, apps/web, services/api, supabase/migrations, packages/contracts, plus stack-specific research. Nothing here has been fixed — this is a read-only findings list, ranked by severity.

## The one-sentence version

**Both client apps (web + mobile) are a fully mocked UI shell.** The FastAPI backend is a 52-line skeleton with only a health-check route. The Supabase schema and RLS policies are genuinely well-designed and already exist — but nothing in either app talks to them. `tsc --noEmit` passes clean on both apps, which only proves the mock is syntactically valid, not that anything works.

---

## CRITICAL — breaks the demo or is actively dangerous

### Backend / data layer
1. **`services/api` has zero business logic.** Only `app/api/v1/health.py` exists — no issues, triage, duplicate-detection, assignment, AI, or audit-job routes. Every workflow claim in `PROJECT_PROPOSAL.md` (AI triage → routing → assignment → verification) has no server-side implementation at all.
2. **RLS gap on `issues` insert** (`supabase/migrations/20260829000200_rls_policies.sql:113-114`): `issues_insert_own` only checks `reporter_id = auth.uid()`. Nothing stops a citizen's insert from setting `status='resolved'`, `severity='critical'`, `is_public=false`, `department_id`, or `duplicate_of_issue_id` directly — the comment says "FastAPI enforces which transitions are legal," but FastAPI doesn't exist yet, so if anyone wires a direct Supabase insert from a client (the fast path in a hackathon crunch), this is wide open today.
3. **Could not verify the live Supabase project.** The connected Supabase MCP account only sees a project called "Classera" (inactive) — not the CivicFix project referenced in `apps/web/.env.local`. Someone with access to the real project needs to confirm the two migrations were actually applied remotely.

### Web app (`apps/web/src`)
4. **`app/app/notifications/page.tsx` imports `MOCK_NOTIFICATIONS`, which doesn't exist** in `lib/mock-data.ts`. This is a real crash: the page throws the moment it renders.
5. **No auth/role guard on `/admin/*` or `/app/*` at all.** No `middleware.ts`, no `supabase.auth.getUser()` check anywhere in the shells/layouts. Typing `/admin/users` into the URL bar gets anyone — signed in or not — the full staff console.
6. **`SignInForm.tsx` routes every successful login to `/admin`**, citizen or staff, compounding #5.
7. **Staff access-request approval is entirely fake** (`admin/access-requests/AccessRequestTable.tsx`): hardcoded fictional requests, `decide()` only touches local `useState`, Approve/Reject never write to `staff_access_requests`, `user_roles`, or `audit_logs`. This is the one flow the spec calls the platform's core security control.
8. **Report submission never persists.** `ReportComposer.tsx`'s `handleSubmit` fakes a tracking ID with `Math.random()`, never calls the API or Supabase, never uploads the photo file (only a local blob preview).
9. **Fabricated live-looking stats**: landing page count-up shows "12K+ Reports," "89.4% Resolved Within SLA," "1.2K+ Active Residents," "Trusted by 40+ city departments" — numbers drift between `LandingStats.tsx` and `AuthShowcase.tsx`, and none exist in any data.
10. Every "live" page (map, admin queue, analytics, audit, SLA, my-reports) renders from `lib/mock-data.ts` — confirmed zero `supabase.from(...)` calls anywhere under `app/admin` or `app/app`.

### Mobile app (`apps/mobile`)
11. **100% mock data, zero network/Supabase wiring.** No `@supabase/supabase-js` in `package.json`. Zero matches for `fetch(`, `supabase`, `axios`, `AsyncStorage` anywhere in `app/`/`lib/`.
12. **Auth is a stub that accepts anything**: `auth-context.tsx` — `signIn: (email, role) => setUser(...)`, no password, no Supabase call. The sign-in screen literally says "Demo mode: any email signs you in as the selected role."
13. **A signed-in user can self-elevate their own role** via `profile.tsx`'s role toggle (citizen ⇄ field_worker) at any time — this is the exact "self-service elevation" failure the spec explicitly names as the most dangerous failure mode in a civic system.
14. **Report submission never persists** (mirrors web): fake tracking ID, `setTimeout`, navigate to confirmation. The new report never appears in "My reports."
15. **Camera/location are booleans, not real permissions/APIs.** `expo-image-picker` and `expo-location` are installed but never imported/called anywhere. No permission dialog ever fires.
16. **Offline sync queue is decorative** — hardcoded two-row array, no `AsyncStorage`, no retry logic, `DraftReport` type defined but never used.
17. **Mobile theme (`lib/theme.ts`) is a light theme**; `DESIGN.md` mandates dark monochrome (black bg, white ink, pill radii). The entire app's visual system contradicts its own spec.

---

## MEDIUM — real bugs, not demo-fatal alone

- `admin/queue/[id]/TriagePanel.tsx`: "Assign to department queue" button has no `onClick` at all.
- `AdminShell.tsx`: topbar search + notification/account icons have no handlers.
- `LocationPicker.tsx`: geolocation error callback swallows the error silently (`setFailed(false)`) instead of surfacing anything to the user.
- Hardcoded fake identities shown regardless of who's signed in ("Amara Okonkwo," "Priya Nair") in both shells and the profile page.
- `packages/contracts/issue.ts` is declared as a web dependency but **never imported** — `apps/web/src/lib/types.ts` defines its own divergent `Issue` shape. Wiring a real API later means reconciling two incompatible type definitions.
- Mock data is internally inconsistent: `MOCK_DEPARTMENTS` claims 6 open issues for "Streets & Roads" but only 2 matching issues exist in `MOCK_ISSUES`.
- Mobile home tab (`app/(tabs)/index.tsx`) imports `useRouter` but never uses it — tapping a "nearby report" card does nothing.
- Mobile field-worker `evidence.tsx`/`navigate.tsx`: "Submit for verification" only flips local state; "Open in Maps app" is a literal empty `onPress`.
- `apps/mobile/app.json` has no `expo-image-picker`/`expo-location` config plugin entries — harmless today since those APIs are never called, but the moment real camera/location code is added, iOS builds will silently omit the required `Info.plist` usage-description strings and crash on permission request.

## LOW — cleanup

- `components/Reveal.tsx` is dead code (never imported), despite `DESIGN.md` listing it as a required motion primitive.
- Font Awesome pulled from `cdnjs.cloudflare.com` for 3 landing icons — unnecessary third-party script for what could be inline SVG.
- MapLibre popups use raw `setHTML` (properly escaped — no XSS) but aren't keyboard-focusable; the list fallback below covers this per spec, so it's minor.
- No Tailwind violations found — verified clean; `packages/ui-web` correctly uses CSS Modules.

---

## Infrastructure / process risks (from research, not yet observed failing)

- **Next.js 16's `next dev` defaults to Turbopack**, which has a documented HMR incompatibility with `maplibre-gl` (map renders empty in dev; works fine on `next build && next start` or with `--webpack`). [Reported case](https://github.com/vercel/next.js/issues/86495): before the actual demo, test with a production build, not just `npm run dev`.
- **`tile.openstreetmap.org` actively rate-limits/blocks by IP** under heavy or shared-network usage ([OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/)) — exactly the situation at a hackathon venue where many teams share one WiFi/NAT. `IssueMap.tsx`'s `map.on("error", () => setFailed(true))` treats **any** map error, including a single failed/429 tile, as fatal and drops the whole map to "Map unavailable" for the rest of the session. Worth testing on venue WiFi ahead of time, or scoping the error handler to genuine style-load failures rather than per-tile errors.
- No `supabase/config.toml` — the Supabase CLI project isn't locally linked/initialized, so there's no `supabase db push`/`supabase start` workflow; migrations currently only exist as raw `.sql` files someone has to apply by hand.
- `apps/web/AGENTS.md` explicitly warns this is a pre-release/breaking-changes version of Next.js relative to typical training data — worth a quick skim of `node_modules/next/dist/docs/` before adding new App Router code, since conventions may differ from what's assumed elsewhere in the codebase.

---

## Recommended fix order for a hackathon deadline

1. Fix the notifications crash (missing `MOCK_NOTIFICATIONS` export) — it's a one-line break.
2. Add *some* auth/role gate in front of `/admin/*` and `/app/*` on web, even a minimal one — right now it's wide open.
3. Pick one: either wire the **report submission** happy path (web or mobile, pick one) to a real Supabase insert using the schema that already exists, or make it explicit in the demo narrative that this is a UI prototype ahead of backend integration — don't let a judge discover it's fake by clicking "My reports" a second time.
4. Test the map on the actual venue network before the demo, and switch `next dev` → a production build for the live run.
5. Everything else on this list is real but not demo-fatal if items 1–4 are handled first.
