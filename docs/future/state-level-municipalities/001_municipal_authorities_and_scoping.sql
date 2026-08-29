-- DRAFT — NOT APPLIED. Read docs/future/state-level-municipalities/README.md
-- first, in particular the "open decision" section, before running any of
-- this against a real project. Once the state-vs-city decision is made and
-- this is ready, move it into supabase/migrations/ with a real timestamp
-- filename and apply it as a normal migration — do not edit the migrations
-- already applied in supabase/migrations/.

-- ---------------------------------------------------------------------------
-- Municipal authorities. One row per tenant — either one per state or one
-- per city-level municipal corporation grouped by `state`, per the README's
-- open decision. `territory` is optional on purpose: rows can exist with
-- only a `center_point` (centroid fallback) until real boundary polygons are
-- sourced and loaded.
-- ---------------------------------------------------------------------------
create table public.municipal_authorities (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                   -- e.g. "Jalandhar Municipal Corporation"
  state text not null,                                   -- e.g. "Punjab" — always present, for state-level rollups regardless of which tenancy grain is chosen
  territory geography(MultiPolygon, 4326),                -- real boundary, once sourced (see README)
  center_point geography(Point, 4326) not null,           -- centroid fallback resolver always has something to compare against
  contact_email text,
  sla_hours_default integer not null default 72,
  created_at timestamptz not null default now(),
  unique (name, state)
);

create index municipal_authorities_territory_gix on public.municipal_authorities using gist (territory);
create index municipal_authorities_center_gix on public.municipal_authorities using gist (center_point);

alter table public.municipal_authorities enable row level security;

create policy municipal_authorities_select_all on public.municipal_authorities
  for select using (true);

-- Only a platform-level administrator (not a per-authority admin) may create
-- or edit authorities — this is platform onboarding, not day-to-day admin.
create policy municipal_authorities_platform_admin_write on public.municipal_authorities
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Resolve a lat/lng to an authority. Tries real polygon containment first;
-- falls back to nearest centroid so the app works before boundary data is
-- loaded. Returns null if no authority exists yet (e.g. a fresh project with
-- zero rows) — callers must handle that, not assume a match always exists.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_authority_for_point(
  p_latitude double precision,
  p_longitude double precision
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  point geography;
  matched_id uuid;
begin
  point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  select id into matched_id
  from public.municipal_authorities
  where territory is not null and ST_Contains(territory::geometry, point::geometry)
  limit 1;

  if matched_id is not null then
    return matched_id;
  end if;

  -- Centroid fallback — nearest registered authority by straight-line distance.
  select id into matched_id
  from public.municipal_authorities
  order by center_point <-> point
  limit 1;

  return matched_id;
end;
$$;

revoke all on function public.resolve_authority_for_point(double precision, double precision) from public;
grant execute on function public.resolve_authority_for_point(double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Scope issues and staff to an authority.
-- ---------------------------------------------------------------------------
alter table public.issues add column authority_id uuid references public.municipal_authorities (id);
-- Left nullable during backfill. Flip to `not null` in a follow-up migration
-- once every existing row has been backfilled — do not combine both steps,
-- or the migration fails outright on any existing data.

alter table public.user_roles add column authority_id uuid references public.municipal_authorities (id);
-- Null for citizens and for the two platform-wide roles (administrator,
-- auditor) if you decide platform roles should see across all authorities;
-- required (enforce with a follow-up CHECK) for field_worker/department_manager.

create index issues_authority_idx on public.issues (authority_id, status);
create index user_roles_authority_idx on public.user_roles (authority_id);

-- Resolve authority_id automatically at insert time — never client-settable,
-- same pattern as the existing issues_before_insert trigger.
create or replace function public.issues_resolve_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.authority_id := public.resolve_authority_for_point(
    ST_Y(new.location::geometry), ST_X(new.location::geometry)
  );
  return new;
end;
$$;

create trigger issues_resolve_authority
  before insert on public.issues
  for each row execute function public.issues_resolve_authority();

create or replace function public.current_authority_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select authority_id from public.user_roles where user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Tenancy wall. Every existing staff-facing policy currently checks only
-- `is_staff()` / `is_admin()` — none of them know about authorities yet.
-- These are illustrative replacements for the ones in
-- 20260829000200_rls_policies.sql; apply the equivalent change to every
-- staff-facing policy on issues, issue_media, issue_events, assignments, and
-- resolution_evidence, not just the one shown here, or the tenancy wall has
-- holes.
-- ---------------------------------------------------------------------------
drop policy if exists issues_select_public on public.issues;
create policy issues_select_public on public.issues
  for select using (
    (is_public and deleted_at is null)
    or reporter_id = auth.uid()
    or (public.is_staff() and authority_id = public.current_authority_id())
  );

-- The audited RPCs (update_issue_status, route_issue_department,
-- mark_issue_duplicate, assign_worker, approve_staff_access_request) each
-- need one added line: after confirming `is_staff()`, also confirm the
-- target issue's `authority_id` equals `current_authority_id()`, and raise
-- an exception otherwise. Do this as one pass across all of them together —
-- ship it as a single migration, not incrementally, so there's never a
-- window where some privileged actions are tenancy-scoped and others aren't.
