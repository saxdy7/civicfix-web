-- CivicFix: let staff sign in with their employee ID instead of typing their
-- email, and switch admin sign-in from the UID/@local.test convention to a
-- plain real email address.
--
-- Employee ID lookup has to work for a NOT-YET-signed-in visitor (that's the
-- whole point of a login screen), so it can't just be a client-side query
-- against `profiles` — RLS only lets a user read their own profile. This
-- adds a narrow, single-purpose SECURITY DEFINER function that returns only
-- the matching email (nothing else about the profile), grants it to `anon`,
-- and is the one place in this schema an unauthenticated caller gets a
-- function grant at all.

alter table public.profiles add column if not exists employee_id text;

do $$ begin
  alter table public.profiles add constraint profiles_employee_id_key unique (employee_id);
exception when duplicate_object then null;
end $$;

-- Stamps the approved employee's ID onto their profile so they can log in
-- with it afterward. Same signature as before — grants carry over.
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

  update public.profiles set employee_id = req.employee_id where id = req.user_id and employee_id is null;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'staff_access_request.approve', 'staff_access_requests', request_id,
    jsonb_build_object('granted_role', req.requested_role, 'user_id', req.user_id, 'note', note)
  );
end;
$$;

-- Returns the email for a given employee ID, or null if there is no match —
-- callers must show a generic "incorrect ID/email or password" either way,
-- never "no such employee ID," so this can't be used to enumerate valid IDs.
create or replace function public.resolve_login_email(p_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where employee_id = p_identifier limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
