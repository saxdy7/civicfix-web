# Future phase: state-level municipal tenancy + AI photo triage

Status: **planning only — nothing in this folder is applied or wired into the running app.**
It exists so the next implementation pass has a concrete starting point instead of a blank page.

## What was asked for

CivicFix today is a single shared tenant: every issue, department, and staff account lives in
one flat Supabase project with no notion of "which authority is this for." The ask is to make
CivicFix operate **per state-level municipal authority** (the example given was Punjab, with a
"Jalandhar Municipal Corporation" and "Punjab Municipal Corporation" both mentioned) such that:

- A resident's report is automatically scoped to the state-level authority whose territory
  contains the report's location — never manually chosen by the reporter.
- Staff accounts belong to exactly one authority and can only ever see, triage, and act on
  reports inside that authority's territory. A Punjab admin must never see another state's
  reports, and vice versa — this is a hard tenancy boundary, not a filter the UI merely hides.
- The same rule applies identically on the mobile app and the website — one shared database,
  one shared scoping rule, enforced at the RLS/RPC layer so neither client can bypass it.
- A later phase adds AI-assisted photo analysis (object/damage detection on the submitted
  photo) feeding into the existing `ai_assessments` table and staff triage screen.

## Open decision this planning pass could not resolve on its own

The request itself is inconsistent about the unit of tenancy: it says explicitly **"implementing
the municipal things at the state levels, not at the city level"**, but the only two example
authorities named — "Jalandhar Municipal Corporation" (a city-level body) and "Punjab Municipal
Corporation" (a state-level framing) — mix both granularities. The draft schema in
`001_municipal_authorities_and_scoping.sql` is written to support **either** answer without a
rewrite (see "Design choice" below), but someone needs to confirm before this is built for real:

1. **One authority per state** (e.g. a single "Punjab" authority covering the whole state), or
2. **One authority per city/municipal corporation**, grouped under a state for reporting/rollup
   purposes (e.g. "Jalandhar Municipal Corporation" and "Ludhiana Municipal Corporation" both
   under Punjab, each with its own staff and queue).

Option 2 is what "municipal corporation" means in Indian civic administration (a municipal
corporation is a city-level body; states don't run one single corporation for the whole state),
and it's also what most demo narratives care about ("Jalandhar's office sees Jalandhar's
reports"). Option 1 is simpler to build and matches the literal "state level, not city level"
instruction. **Recommendation: build option 2** (city-level `municipal_authorities`, with a
`state` column for grouping/analytics) since it matches real-world terminology and still
satisfies "state level" reporting by rolling city authorities up by state — but this is a product
call, not a technical one, and the draft SQL is written so either reading is a small change, not
a rewrite.

## Design choice: boundary matching

Given a report's `location geography(Point,4326)`, CivicFix needs to resolve which authority's
territory contains it. Two options, in increasing order of correctness and setup cost:

1. **Point-in-polygon against real administrative boundaries** — store each authority's
   territory as a `geography(MultiPolygon,4326)` (sourced from India's Survey General /
   OpenStreetMap administrative boundary exports) and resolve with `ST_Contains`. This is
   correct at the edges (a report right on a city line resolves correctly) but requires sourcing
   and loading real boundary polygon data before it can be enabled — that data acquisition is
   the actual blocking work here, not the schema.
2. **Nearest-authority-centroid fallback** — until real polygons are loaded, resolve to
   whichever authority's registered center point is geographically closest
   (`ST_Distance`/`<->`). Wrong near a boundary, fine everywhere else, and needs zero external
   data — a reasonable bridge for a demo.

The draft migration includes the `territory` polygon column and both a polygon-based and a
centroid-fallback resolver function, so the app can ship with option 2 today and upgrade to
option 1 the moment real boundary data is loaded, with no application-code change.

## What the draft migration adds

See `001_municipal_authorities_and_scoping.sql` (not applied — read it, adjust the option-1-vs-2
decision above, then apply as a normal migration when this phase starts):

- `municipal_authorities` — id, name, state, optional `territory` polygon, a centroid point for
  the fallback resolver, and its own SLA/contact metadata.
- `issues.authority_id` — a new required foreign key, populated at insert time by
  `resolve_authority_for_point(lat, lng)`, never settable by the client directly (same pattern as
  the existing `issues_before_insert` trigger that already strips other client-supplied fields).
- `user_roles.authority_id` — which authority a staff member belongs to. `NULL` for citizens.
- Every existing staff-facing RLS policy and the triage/resolution/assignment RPCs
  (`update_issue_status`, `route_issue_department`, `mark_issue_duplicate`, `assign_worker`,
  `approve_staff_access_request`) gets an added `and current_authority_id() = target authority`
  check — this is the actual tenancy wall. Today those functions only check `is_staff()`;
  tomorrow they must also check "and it's *your* authority's issue."
- A `current_authority_id()` helper (mirrors the existing `is_staff()`/`is_admin()` pattern):
  reads the caller's `user_roles.authority_id`.

## What is explicitly NOT in this draft

- Real Indian state/city boundary polygon data — has to be sourced (e.g. from
  [Bhuvan](https://bhuvan.nrsc.gov.in/) / [OpenStreetMap's India admin boundaries](https://www.openstreetmap.org))
  and loaded before option 1 above can be enabled.
- Any application code (web/mobile UI, FastAPI) reading or writing `authority_id` — this is
  schema-only. Wiring the UI (staff sign-up requesting an authority, admin queues filtered to
  the signed-in staff member's authority, the public map showing all authorities or filtering by
  one) is a full follow-up implementation pass once the tenancy model above is confirmed.
- AI photo analysis. That is unaffected by this scoping work and already has a home: the
  existing `ai_assessments` table plus a not-yet-built FastAPI endpoint that calls Groq's vision
  model on the uploaded photo, writes a structured `{category, severity, summary, confidence}`
  row, and surfaces it in the triage screen exactly where `TriagePanel.tsx`'s "AI-assisted
  suggestion" card already has a slot waiting for it (`apps/web/src/app/admin/queue/[id]/TriagePanel.tsx`).
  No new table is needed for that part — it's an orchestration/API-endpoint task, not a schema
  task, and is unrelated to the state/authority work above.

## Suggested build order, when this phase starts

1. Resolve the state-vs-city decision above with the client/judges.
2. Source at least Punjab's city-level boundaries (or accept the centroid fallback for the demo).
3. Apply the migration, backfill `authority_id` on any existing rows, then flip the column to
   `not null`.
4. Update every RLS policy and RPC listed above to add the authority check — do this as one
   atomic change, not incrementally, since a half-updated set of checks is worse than none (some
   endpoints would enforce tenancy, others wouldn't).
5. Add authority selection to the staff access-request flow (`/staff/request-access` already
   collects a department; add an authority field alongside it) and filter every admin
   screen's queries by the signed-in staff member's `authority_id`.
6. Only then take on AI photo triage — it's independent of tenancy and safe to build in parallel
   or after.
