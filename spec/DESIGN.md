# CivicFix Design Specification

## Product principles

Design for fast reporting, clear public accountability, human control over AI, calm use under pressure, and accessibility by default.

## Platform and UI rules

React Native + TypeScript is the primary hackathon client; Expo is recommended. Next.js + TypeScript is the website. The website uses shadcn/ui patterns, CSS Modules, and CSS variables. Tailwind CSS is prohibited in the website and is not introduced for mobile. Both clients use Supabase Auth and the same Supabase PostgreSQL/PostGIS database.

Map components follow **MapCN** composition patterns on **MapLibre GL**. MapCN ships copy-paste components styled with Tailwind; those classes must be stripped and re-implemented as CSS Modules against the tokens below. Never introduce a Tailwind config, utility classes, or build dependency.

---

# Visual design system

The system is **dark and monochrome**: a black page, white ink, generous whitespace, pill-shaped controls, softly rounded cards, and a retro dot-matrix display face for headings. Color is a signal, not decoration.

## 1. Color

**Black background, white foreground is the primary contrast pair.** Accent colors are reserved exclusively for status and category signal — never for page chrome, primary buttons, headers, or navigation.

| Token | Value | Use |
|---|---|---|
| `--color-background` | `#000000` | Page ground |
| `--color-background-muted` | `#0a0a0b` | App-shell ground behind cards |
| `--color-surface` | `#111113` | Card and panel fill |
| `--color-surface-muted` | `#1a1a1d` | Secondary fill, hover states |
| `--color-surface-raised` | `#202024` | Popovers, map chrome |
| `--color-foreground` | `#ffffff` | Primary text |
| `--color-muted-foreground` | `#8e8e8e` | Secondary body text |
| `--color-dim-foreground` | `#5f5f63` | Tertiary meta, placeholders |
| `--color-border` | `rgba(255,255,255,0.12)` | Borders and dividers |
| `--color-pill-dark` | `#28282a` | Dark pills (Sign in, trust row) |

**Inverse is the light side.** `--color-inverse-background: #ffffff` / `--color-inverse-foreground: #0a0a0a` drive primary buttons, the active sidebar pill, the white nav pill, and map markers — everything that must pop out of the dark.

Accent tokens (`--color-civic-blue|green|amber|red` plus each `-soft` pair) are tuned for dark ground: a light readable text hue over a low-alpha tint of the same color. They appear **only** in status pills, category signal, and audit-severity dots.

**This is a deliberately single-look design.** There is no light-mode block.

## 2. Typography

Two faces:

- **Inter** (`--font-sans`, CDN) — all UI, body copy, labels, tables, buttons.
- **BubbledotICG-FinePos** (`--font-display`, OnlineWebFonts CDN) — a retro dot-matrix face used for the landing headline, every page `h1`, section titles, stat glyphs, and the wordmark. Falls back to `"Geist Pixel Circle", monospace`.

Rules:
- Display type is always `font-weight: 400` with tight tracking (`-0.04em` to `-0.05em`) and line height `1.1`–`1.15`. It is never bolded — the face carries its own weight.
- Display type is for headings only. Never set body copy, form labels, or table content in it.
- Scale: `--font-size-xs` 12 · `sm` 14 · `md` 16 · `lg` 20 · `xl` 24 · `2xl` 32 · `3xl` 44.
- Body copy is `--color-muted-foreground`, line height `1.6`, capped near `58ch`.

## 3. Shape and spacing

- Radii: `--radius-pill` 999px (all buttons, chips, badges, nav links), `--radius-control` 10px (inputs, small tiles), `--radius-card` 20px (cards, panels), `--radius-hero` 28px (hero and CTA blocks).
- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- Section rhythm on marketing pages is `--space-8` (64px) between sections.
- Controls are 44px tall minimum (48px for hero CTAs) to satisfy touch-target rules.

## 4. Core components (`packages/ui-web`)

| Component | Notes |
|---|---|
| `Button` | Pill. `primary` = white fill / black text. `secondary` = surface fill, bordered. `ghost` = transparent. Optional `block`. |
| `Badge` | Pill. Tones: `neutral`, `info`, `success`, `warning`, `danger`. Carries the status vocabulary. |
| `Card` | 20px radius, 1px border. Tones: `default` (surface), `muted` (surface-muted, borderless), `inverse` (white — a light card that pops out of the dark). `flush` removes padding for media. |
| `Eyebrow` | Small bordered pill label above a section headline. Centered variant for marketing sections. |
| `Stat` | Large tight-tracked number over a muted label. |

Feature components compose these: `IssueMap`, `StatusPill`, `PublicShell`, `AdminShell`, `LandingNav`, `LandingStats`, `GsapReveal`, `Reveal`, `SmoothScroll`, `ApiStatus`, plus the still-to-build `ReportComposer`, `PhotoCapture`, `LocationPicker`, `StatusTimeline`, `AssignmentPanel`, and `AuditFindingCard`.

## 5. Layout patterns

These recur across the site and should be reused rather than reinvented:

- **Pill navigation** — a white pill nav floating on the dark ground. Circular white logo mark left; links in `--color-nav-text` at 0.5 opacity, 1.0 when active; the active link carries **three 3×3px dots** beneath it (`::after` plus ±5px box-shadow offsets). The link must be full-height flex-centred so the dots clear the text — anchoring dots to a text-height box makes them strike through the label.
- **Video hero** — full-bleed looping `object-fit: cover` video behind a single locked viewport: trust row, dot-matrix headline, capped subhead, glowing white pill CTA, and a 4-up stat footer that counts up on entry.
- **Trust row** — three overlapping dark rings (`padding: 5px`, white inner circle, black icon) at `-0.42×` margin overlap, followed by a dark pill whose left padding clears the last avatar.
- **Bento grid** — 3-column asymmetric grid mixing one tall card, one wide card, single cards, and a full-width row. **Cell math must fill exactly**; an orphan cell is a bug.
- **Split-panel auth** — form left (max 380px, centred), dark showcase panel right with dot-matrix headline, tick list, and stat row. The panel collapses below 900px.
- **Sidebar app shell** — dark sidebar card with grouped nav (white active pill), a user card pinned to the bottom, a search topbar, and a dark content card.

## 6. Motion

Three layers, all of which must degrade safely:

- **Lenis** (`SmoothScroll`) — page-level smooth scrolling.
- **GSAP + ScrollTrigger** (`GsapReveal`) — the landing page's section reveals. Pass a `stagger` selector to sequence children at 0.09s intervals; `once: true` so nothing replays.
- **CSS keyframes** — the hero's entrance (`reveal`, `revealPulse`, `slideDown`, `headlineFade`) driven by an inline `--d` delay.

Two hard rules:

1. **Reduced motion wins.** `SmoothScroll`, `Reveal`, `GsapReveal` and `LandingStats` all check `prefers-reduced-motion` and disable themselves, showing final values immediately.
2. **Content is never hidden by default.** `Reveal` applies its hidden state only after JS arms it (`data-armed="true"`) and carries a 2.5s failsafe; `GsapReveal` animates *from* a hidden state it sets itself, so the served HTML is visible. Never author an animation whose resting state is invisible.

## 7. Accessibility

Target WCAG 2.2 AA: semantic landmarks, a keyboard and list alternative to every map interaction, visible focus rings (2px, `--color-foreground`), 44px touch targets, labelled fields with clear error text, contrast-checked tokens, live regions for submission and status, and reduced-motion support.

The dot-matrix display face is decorative and low-legibility at small sizes — never use it below 24px, and never for body copy, labels, or data.

Status is never communicated by color alone — every status pill carries text, and audit severity pairs its dot with a written category.

---

## Screens and ownership

| Area | Screens |
|---|---|
| Public website | Landing (video hero + 7 scrolling sections), live issue map, public issue detail, how it works, accessibility/privacy. |
| Auth | Sign in, resident sign up, staff request-access (all split-panel). |
| Citizen mobile app | Sign in, report issue, confirmation/tracking ID, my reports, notifications, profile. |
| Admin website | Operations dashboard, issue queue/detail/triage, assignment board, departments/SLA, analytics, daily audit, staff access requests, user/role management. |
| Field-worker mobile app | My assignments, assignment detail, navigation handoff, resolution evidence, offline sync queue. |

React Native is the primary surface for report submission, my reports, notifications, field-worker assignments, evidence capture, and camera/location/push permission. Next.js is the public map, public issue detail, operations dashboard, issue queue, daily audit, and user/role management. Both share the same session identity, issue data, status vocabulary, and FastAPI workflow rules.

## User flows

**Citizen:** choose category, add a recommended photo, capture GPS or place a pin, describe the issue, review privacy, submit, receive a tracking ID, and follow status notifications.

**Administrator:** open triage queue, review AI suggestion and duplicate candidates, correct category/priority, select department, assign worker, and monitor SLA.

**Field worker:** accept assignment, open map location, begin work, upload before/after evidence, submit for verification, then receive resolution/reopen feedback.

**Verification:** an authorized administrator or policy-selected citizen reviews evidence and either resolves or reopens with a reason; the reporter receives a notification.

## Map behavior and statuses

MapLibre GL renders free OpenStreetMap raster tiles with no API key. It supports clustering at low zoom, category/status/severity filters, locate-me, an accessible list alternative, and marker-to-detail interaction. Markers are monochrome circular pins carrying a category initial. Public locations are generalized. On map failure, present sortable issue cards with neighborhood and location text.

**Implementation note:** MapLibre's stylesheet forces `position: relative` onto the map container element. The container must therefore size itself (`width/height: 100%`) rather than rely on absolute insets, or it collapses to zero height and renders blank.

| Status | Citizen-facing language |
|---|---|
| Reported | Submitted and awaiting review. |
| Triaged | Reviewed and being routed. |
| Duplicate | Linked to an existing report. |
| Assigned | Work assigned. |
| In progress | Work underway. |
| Pending verification | Evidence submitted for review. |
| Resolved | Resolution verified. |
| Reopened | More work needed. |
| Rejected | Not actionable, with reason. |

## Responsive and states

Mobile uses a bottom-sheet map detail, a thumb-reachable report action, camera-first reporting, and minimal typing. Tablet uses split map/list when room permits. Desktop uses persistent filters and map/detail panels with keyboard-efficient tables. Marketing grids collapse 4→2→1; the auth showcase panel hides below 900px; the admin sidebar stacks below 900px.

Loading uses skeletons and map progress with a list fallback. Empty states explain why and offer reset/report actions. Errors use plain language, retry options, and preserve report drafts. Success shows a tracking ID, next step, and notification preference. Offline states queue citizen drafts and worker evidence locally, visibly marked as unsynced.

## Content safety and implementation rules

Label all AI suggestions as AI-assisted and make staff correction easy. Provide spam/unsafe-content reporting, moderation outcomes, and no public disclosure of reporter contact data.

Never add Tailwind utilities, a Tailwind config, or Tailwind build dependencies — including when porting MapCN components. Adapt shadcn/ui patterns through CSS Modules and token variables on the website; use native React Native primitives on mobile. Every status visual includes text and exactly matches the architecture workflow. Every map-only action has a keyboard and list-based alternative. Supabase Auth remains the shared login path and the shared Supabase PostgreSQL/PostGIS project remains the only canonical application database.

---

# Registration, roles and verification

Two populations use CivicFix and they must **never** share a registration path.

## Residents — self-serve

1. Sign up at `/sign-up` with name, email and password (or Google).
2. Accept terms, privacy policy and consented location collection.
3. Email is verified; the account is immediately usable.
4. Role is always `citizen`. It cannot be elevated from the client under any circumstance.

Residents can report, track their own reports, confirm a neighbour's report, and receive
notifications. They can never see another reporter's contact details or exact coordinates.

## City staff — request and verify

Staff **cannot self-register into a privileged role**. Self-service elevation is the single
most dangerous failure mode in a civic system, so the flow is request → verify → grant.

1. Apply at `/staff/request-access` with full name, **municipal work email**, **employee ID**,
   department and requested role (`field_worker` or `department_manager`).
2. Accept the staff terms — access reporter data only as needed for duties, no export or
   sharing, and acknowledgement that every privileged action is permanently audit-logged.
3. The request lands in `/admin/access-requests` as `pending`.
4. An existing administrator verifies the employee ID against the department roster, then
   approves or rejects.
5. On approval the role is granted and an append-only `audit_logs` entry records the approver,
   the subject, the role granted, and the timestamp. On rejection the applicant is emailed.

`administrator` and `auditor` roles are **never** requestable through the UI. They are granted
only by an existing administrator from `/admin/users`, and are equally audit-logged.

### Verification rules

- The work email domain should be checked against a configured municipal allowlist; a
  non-municipal domain is a strong rejection signal but is surfaced to the reviewer rather than
  auto-rejected.
- Employee ID is verified out-of-band against the department roster — CivicFix does not treat a
  self-supplied ID as proof.
- Approval must be performed by a **different** person than the applicant; self-approval is
  rejected server-side.
- A revoked or deactivated staff account loses role scope immediately; its historical audit
  entries are retained permanently.

### Authorization boundary

Role checks are enforced in FastAPI against the verified Supabase JWT and the `user_roles`
table. Authorization never relies on `user_metadata`, which the user can edit. RLS policies
provide defence in depth on any table exposed directly to clients.
