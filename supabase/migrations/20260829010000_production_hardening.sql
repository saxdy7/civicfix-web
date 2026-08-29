-- CivicFix production hardening
-- 1. Close the issues-insert RLS gap: a citizen's insert can only ever land
--    as an untriaged, public, undeparmented report — no client can set
--    status/department/duplicate-link/visibility at intake, regardless of
--    what a request body contains, until FastAPI-owned triage exists.
-- 2. Server-generated tracking IDs (never client-supplied).
-- 3. The `notifications` / `device_tokens` tables named in ARCHITECTURE.md
--    but missing from the initial schema.
-- 4. Atomic, audited staff-access-request approve/reject as SECURITY DEFINER
--    RPCs — the same "server-side only" pattern already used by has_role()/
--    is_admin(), so this doesn't require standing up FastAPI first.

-- ---------------------------------------------------------------------------
-- Issue intake hardening
-- ---------------------------------------------------------------------------
create sequence if not exists public.issues_tracking_seq start 10001;

create or replace function public.issues_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.tracking_id := 'CF-' || nextval('public.issues_tracking_seq')::text;
  new.status := 'reported';
  new.department_id := null;
  new.duplicate_of_issue_id := null;
  new.is_public := true;
  new.version := 1;
  return new;
end;
$$;

drop trigger if exists issues_before_insert on public.issues;
create trigger issues_before_insert
  before insert on public.issues
  for each row execute function public.issues_before_insert();

-- ---------------------------------------------------------------------------
-- Notifications and device tokens
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  issue_id uuid references public.issues (id) on delete set null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No client insert policy: notifications are written server-side once the
-- job runner exists, matching audit_logs/ai_assessments.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'unknown',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.device_tokens enable row level security;

drop policy if exists device_tokens_own on public.device_tokens;
create policy device_tokens_own on public.device_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Staff access-request decisions: atomic, admin-only, audited.
-- Runs as SECURITY DEFINER so it can grant a role (user_roles has no client
-- write policy at all) and write the audit record in the same transaction.
-- The existing `no_self_approval` check constraint still applies.
-- ---------------------------------------------------------------------------
create or replace function public.approve_staff_access_request(request_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  if not public.is_admin() then
    raise exception 'Only administrators may approve staff access requests';
  end if;

  select * into req from public.staff_access_requests where id = request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already decided';
  end if;

  if req.user_id is null then
    raise exception 'Request has no linked user account';
  end if;

  update public.staff_access_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = note
  where id = request_id;

  insert into public.user_roles (user_id, role, department_id, granted_by)
  values (req.user_id, req.requested_role, req.department_id, auth.uid())
  on conflict (user_id, role) do nothing;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'staff_access_request.approve', 'staff_access_requests', request_id,
    jsonb_build_object('granted_role', req.requested_role, 'user_id', req.user_id, 'note', note)
  );
end;
$$;

create or replace function public.reject_staff_access_request(request_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  if not public.is_admin() then
    raise exception 'Only administrators may reject staff access requests';
  end if;

  select * into req from public.staff_access_requests where id = request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already decided';
  end if;

  update public.staff_access_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = note
  where id = request_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'staff_access_request.reject', 'staff_access_requests', request_id,
    jsonb_build_object('user_id', req.user_id, 'note', note)
  );
end;
$$;

revoke all on function public.approve_staff_access_request(uuid, text) from public;
revoke all on function public.reject_staff_access_request(uuid, text) from public;
grant execute on function public.approve_staff_access_request(uuid, text) to authenticated;
grant execute on function public.reject_staff_access_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Issue creation RPC. supabase-js can't serialize a lat/lng pair into a
-- PostGIS geography column directly, and issue_events has no client insert
-- policy by design (server-side only) — so report submission goes through
-- this single SECURITY DEFINER call rather than a raw client-side insert.
-- It always attributes the report to the caller; it can never create an
-- issue, or an event, for anyone else.
-- ---------------------------------------------------------------------------
create or replace function public.create_issue(
  p_category issue_category,
  p_description text,
  p_severity issue_severity,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m numeric default null,
  p_neighborhood text default null,
  p_storage_key text default null,
  p_mime_type text default null,
  p_checksum text default null
)
returns table (id uuid, tracking_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  new_tracking text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to file a report';
  end if;
  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Location out of bounds';
  end if;
  if length(trim(p_description)) < 15 then
    raise exception 'Description must be at least 15 characters';
  end if;

  insert into public.issues (
    reporter_id, category, description, severity, priority, location, reported_accuracy_m, neighborhood
  )
  values (
    auth.uid(), p_category, p_description, p_severity, p_severity,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_accuracy_m, p_neighborhood
  )
  returning issues.id, issues.tracking_id into new_id, new_tracking;

  insert into public.issue_events (issue_id, status, actor_id)
  values (new_id, 'reported', auth.uid());

  if p_storage_key is not null then
    insert into public.issue_media (issue_id, storage_key, mime_type, checksum)
    values (new_id, p_storage_key, coalesce(p_mime_type, 'application/octet-stream'), coalesce(p_checksum, ''));
  end if;

  return query select new_id, new_tracking;
end;
$$;

revoke all on function public.create_issue(
  issue_category, text, issue_severity, double precision, double precision, numeric, text, text, text, text
) from public;
grant execute on function public.create_issue(
  issue_category, text, issue_severity, double precision, double precision, numeric, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: a private bucket for report photos. Citizens can only write under
-- their own uid-prefixed path; staff can read every object for triage/audit.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('issue-media', 'issue-media', false)
on conflict (id) do nothing;

drop policy if exists issue_media_upload_own on storage.objects;
create policy issue_media_upload_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'issue-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists issue_media_read_own_or_staff on storage.objects;
create policy issue_media_read_own_or_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'issue-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

-- ---------------------------------------------------------------------------
-- Assign a field worker. `assignments` intentionally has no client INSERT
-- policy at all (staff can only SELECT, and workers can only UPDATE their own
-- row) — creating an assignment is a privileged act, so it goes through this
-- staff-only SECURITY DEFINER call, which also advances the issue's status
-- and records the transition in issue_events (itself server-side-only) and
-- audit_logs in the same transaction.
-- ---------------------------------------------------------------------------
create or replace function public.assign_worker(
  p_issue_id uuid,
  p_worker_id uuid,
  -- Defaults to 3 days out rather than null: a null due date previously
  -- rendered as "overdue" on both clients the instant it was read back,
  -- since neither had a real fallback for "no due date set." Evaluated
  -- fresh per call (PL/pgSQL defaults aren't baked in at CREATE time), and
  -- still overridable once a UI adds a real due-date picker.
  p_due_at timestamptz default (now() + interval '3 days')
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_assignment_id uuid;
  current_status issue_status;
begin
  if not public.is_staff() then
    raise exception 'Only staff may assign a field worker';
  end if;

  if not exists (
    select 1 from public.user_roles where user_id = p_worker_id and role = 'field_worker'
  ) then
    raise exception 'Target user is not a field worker';
  end if;

  select status into current_status from public.issues where id = p_issue_id;
  if not found then
    raise exception 'Issue not found';
  end if;

  insert into public.assignments (issue_id, worker_id, assigned_by, due_at)
  values (p_issue_id, p_worker_id, auth.uid(), p_due_at)
  returning id into new_assignment_id;

  if current_status in ('reported', 'triaged') then
    update public.issues set status = 'assigned', updated_at = now() where id = p_issue_id;

    insert into public.issue_events (issue_id, status, actor_id, note)
    values (p_issue_id, 'assigned', auth.uid(), 'Assigned to a field worker.');
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'assignment.create', 'assignments', new_assignment_id,
    jsonb_build_object('issue_id', p_issue_id, 'worker_id', p_worker_id)
  );

  return new_assignment_id;
end;
$$;

revoke all on function public.assign_worker(uuid, uuid, timestamptz) from public;
grant execute on function public.assign_worker(uuid, uuid, timestamptz) to authenticated;
