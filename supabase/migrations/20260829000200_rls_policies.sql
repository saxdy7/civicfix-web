-- CivicFix Row Level Security
-- RLS is defence in depth. FastAPI remains the authority on workflow transitions;
-- these policies bound what a client holding a user JWT can ever reach directly.

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can read user_roles without
-- recursing through that table's own policies.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(target_role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = target_role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('field_worker', 'department_manager', 'administrator', 'auditor')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'administrator'
  );
$$;

-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.staff_access_requests enable row level security;
alter table public.issues enable row level security;
alter table public.issue_media enable row level security;
alter table public.issue_events enable row level security;
alter table public.assignments enable row level security;
alter table public.resolution_evidence enable row level security;
alter table public.confirmations enable row level security;
alter table public.ai_assessments enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: own row, or staff reading any.
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Roles: readable by self and staff. NO client may ever write — role grants
-- happen only through FastAPI/service-role or the signup trigger.
-- ---------------------------------------------------------------------------
create policy user_roles_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Departments: public read, admin write.
-- ---------------------------------------------------------------------------
create policy departments_select_all on public.departments
  for select using (true);

create policy departments_admin_write on public.departments
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Staff access requests: applicants see their own; admins see and decide all.
-- An applicant may insert only a request for themselves, and only 'pending'.
-- ---------------------------------------------------------------------------
create policy access_requests_select_own on public.staff_access_requests
  for select using (user_id = auth.uid() or public.is_admin());

create policy access_requests_insert_self on public.staff_access_requests
  for insert with check (user_id = auth.uid() and status = 'pending');

create policy access_requests_admin_update on public.staff_access_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Issues: public rows are world-readable; reporters see their own; staff see all.
-- Any authenticated user may file a report as themselves. Updates are staff-only
-- (FastAPI enforces which transitions are legal).
-- ---------------------------------------------------------------------------
create policy issues_select_public on public.issues
  for select using (
    (is_public and deleted_at is null)
    or reporter_id = auth.uid()
    or public.is_staff()
  );

create policy issues_insert_own on public.issues
  for insert with check (reporter_id = auth.uid());

create policy issues_staff_update on public.issues
  for update using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Media: visible with its issue; reporter may attach to their own issue.
-- ---------------------------------------------------------------------------
create policy issue_media_select on public.issue_media
  for select using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id
        and ((i.is_public and i.deleted_at is null) or i.reporter_id = auth.uid() or public.is_staff())
    )
  );

create policy issue_media_insert_own on public.issue_media
  for insert with check (
    exists (select 1 from public.issues i where i.id = issue_id and i.reporter_id = auth.uid())
    or public.is_staff()
  );

-- ---------------------------------------------------------------------------
-- Events: readable with the issue. Insert is server-side only (no client policy).
-- ---------------------------------------------------------------------------
create policy issue_events_select on public.issue_events
  for select using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id
        and ((i.is_public and i.deleted_at is null) or i.reporter_id = auth.uid() or public.is_staff())
    )
  );

-- ---------------------------------------------------------------------------
-- Assignments and evidence: staff only.
-- ---------------------------------------------------------------------------
create policy assignments_staff_select on public.assignments
  for select using (public.is_staff());

create policy assignments_worker_update on public.assignments
  for update using (worker_id = auth.uid() or public.is_admin())
  with check (worker_id = auth.uid() or public.is_admin());

create policy evidence_staff_select on public.resolution_evidence
  for select using (public.is_staff());

create policy evidence_worker_insert on public.resolution_evidence
  for insert with check (submitted_by = auth.uid() and public.is_staff());

-- ---------------------------------------------------------------------------
-- Confirmations: anyone signed in may confirm someone else's issue, once.
-- A reporter may not confirm their own report.
-- ---------------------------------------------------------------------------
create policy confirmations_select on public.confirmations
  for select using (true);

create policy confirmations_insert on public.confirmations
  for insert with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.issues i where i.id = issue_id and i.reporter_id = auth.uid()
    )
  );

create policy confirmations_delete_own on public.confirmations
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AI assessments: staff read only. Writes are service-role only.
-- ---------------------------------------------------------------------------
create policy ai_assessments_staff_select on public.ai_assessments
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Audit log: auditors and admins read. No client writes (service-role only),
-- and the table's rules already block UPDATE/DELETE outright.
-- ---------------------------------------------------------------------------
create policy audit_logs_read on public.audit_logs
  for select using (public.is_admin() or public.has_role('auditor'));
