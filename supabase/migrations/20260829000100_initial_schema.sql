-- CivicFix initial schema
-- Roles, profiles, staff access requests, issues, workflow, evidence, audit.
-- See spec/ARCHITECTURE.md and spec/DESIGN.md.
--
-- Safe to re-run: every statement below is idempotent (if-not-exists /
-- duplicate_object-tolerant), so running this against a database that
-- already has some or all of this schema is a no-op for what's already
-- there rather than an error.

create extension if not exists "postgis";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums. Postgres has no `create type if not exists`, so each is wrapped to
-- tolerate already existing.
-- ---------------------------------------------------------------------------
do $$ begin
  create type issue_status as enum (
    'reported', 'triaged', 'duplicate', 'assigned', 'in_progress',
    'pending_verification', 'resolved', 'reopened', 'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type issue_category as enum ('pothole', 'garbage', 'streetlight', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type issue_severity as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type app_role as enum ('citizen', 'field_worker', 'department_manager', 'administrator', 'auditor');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type access_request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles live in their own table, never in user_metadata (which the user can edit).
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role app_role not null,
  department_id uuid,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists user_roles_user_idx on public.user_roles (user_id);

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  categories issue_category[] not null default '{}',
  sla_hours integer not null default 72,
  created_at timestamptz not null default now()
);

-- Postgres has no `add constraint if not exists`, so this is wrapped the
-- same way as the enum types above.
do $$ begin
  alter table public.user_roles
    add constraint user_roles_department_fk
    foreign key (department_id) references public.departments (id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Staff access requests  (staff can never self-assign a privileged role)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  work_email text not null,
  employee_id text not null,
  department_id uuid references public.departments (id),
  requested_role app_role not null,
  status access_request_status not null default 'pending',
  terms_accepted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  -- Only non-privileged staff roles may ever be requested through the UI.
  constraint requested_role_is_staff
    check (requested_role in ('field_worker', 'department_manager')),
  -- Nobody may approve their own request.
  constraint no_self_approval
    check (reviewed_by is null or user_id is null or reviewed_by <> user_id)
);

create index if not exists staff_access_requests_status_idx on public.staff_access_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Issues
-- ---------------------------------------------------------------------------
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique,
  reporter_id uuid references auth.users (id) on delete set null,
  category issue_category not null,
  status issue_status not null default 'reported',
  severity issue_severity not null default 'medium',
  priority issue_severity not null default 'medium',
  description text not null,
  neighborhood text,
  location geography (Point, 4326) not null,
  reported_accuracy_m numeric,
  department_id uuid references public.departments (id),
  duplicate_of_issue_id uuid references public.issues (id),
  is_public boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists issues_location_gix on public.issues using gist (location);
create index if not exists issues_status_idx on public.issues (status, created_at desc);
create index if not exists issues_category_idx on public.issues (category);
create index if not exists issues_department_idx on public.issues (department_id, status);
create index if not exists issues_reporter_idx on public.issues (reporter_id);

create table if not exists public.issue_media (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  storage_key text not null,
  mime_type text not null,
  checksum text not null,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists issue_media_issue_idx on public.issue_media (issue_id);

-- Immutable lifecycle timeline.
create table if not exists public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  status issue_status not null,
  note text,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists issue_events_issue_idx on public.issue_events (issue_id, created_at);

-- ---------------------------------------------------------------------------
-- Assignments and evidence
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  worker_id uuid references auth.users (id) on delete set null,
  assigned_by uuid references auth.users (id),
  accepted_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists assignments_worker_idx on public.assignments (worker_id);
create index if not exists assignments_issue_idx on public.assignments (issue_id);

create table if not exists public.resolution_evidence (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete set null,
  before_media_id uuid references public.issue_media (id),
  after_media_id uuid references public.issue_media (id),
  note text,
  submitted_by uuid references auth.users (id),
  submitted_at timestamptz not null default now(),
  verified_by uuid references auth.users (id),
  verified_at timestamptz
);

create index if not exists resolution_evidence_issue_idx on public.resolution_evidence (issue_id);

-- ---------------------------------------------------------------------------
-- Community signal
-- ---------------------------------------------------------------------------
create table if not exists public.confirmations (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One confirmation per user per issue.
  unique (issue_id, user_id)
);

-- ---------------------------------------------------------------------------
-- AI assessments (advisory only)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_assessments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_hash text not null,
  output jsonb not null,
  confidence numeric,
  created_at timestamptz not null default now()
);

create index if not exists ai_assessments_issue_idx on public.ai_assessments (issue_id);

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- Audit rows are immutable.
drop rule if exists audit_logs_no_update on public.audit_logs;
create rule audit_logs_no_update as on update to public.audit_logs do instead nothing;
drop rule if exists audit_logs_no_delete on public.audit_logs;
create rule audit_logs_no_delete as on delete to public.audit_logs do instead nothing;

-- ---------------------------------------------------------------------------
-- New users become citizens automatically. Role is assigned here, server-side,
-- so a client can never sign itself up as staff.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'citizen')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
