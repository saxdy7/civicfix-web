-- CivicFix: audited triage/resolution RPCs
--
-- The web admin console (TriagePanel/ResolutionPanel) was writing directly to
-- `issues` from the browser via `.update()` — no lifecycle-transition check,
-- no issue_events row, no audit_logs row, and no write path for a staff
-- note. spec/ARCHITECTURE.md already documents FastAPI as the intended
-- authority for workflow transitions, but FastAPI itself is still just a
-- health check, so this closes the gap the same way approve/reject and
-- assign_worker already do: a narrow, staff-only, SECURITY DEFINER RPC that
-- validates the transition, and writes the issue update, the lifecycle
-- event, and the audit record atomically.

-- ---------------------------------------------------------------------------
-- Status/severity update. Enforces exactly the lifecycle in
-- spec/ARCHITECTURE.md's "Workflow, APIs, and map flow" section.
-- ---------------------------------------------------------------------------
create or replace function public.update_issue_status(
  p_issue_id uuid,
  p_next_status issue_status default null,
  p_severity issue_severity default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row record;
  allowed boolean;
  has_verified_evidence boolean;
begin
  if not public.is_staff() then
    raise exception 'Only staff may change an issue''s status or severity';
  end if;

  select status, severity into current_row from public.issues where id = p_issue_id and deleted_at is null;
  if not found then
    raise exception 'Issue not found';
  end if;

  if p_next_status is not null and p_next_status <> current_row.status then
    allowed := case current_row.status
      when 'reported' then p_next_status in ('triaged', 'duplicate', 'rejected')
      when 'triaged' then p_next_status in ('assigned', 'duplicate', 'rejected')
      when 'assigned' then p_next_status in ('in_progress', 'triaged')
      when 'in_progress' then p_next_status in ('pending_verification', 'triaged')
      when 'pending_verification' then p_next_status in ('resolved', 'reopened')
      when 'resolved' then p_next_status in ('reopened')
      else false
    end;

    if not allowed then
      raise exception 'Cannot move an issue from % to %', current_row.status, p_next_status;
    end if;

    if p_next_status in ('rejected', 'reopened') and coalesce(length(trim(p_note)), 0) < 10 then
      raise exception 'A reason of at least 10 characters is required to reject or reopen an issue';
    end if;

    if p_next_status = 'resolved' then
      select exists (
        select 1 from public.resolution_evidence
        where issue_id = p_issue_id and verified_at is not null
      ) into has_verified_evidence;

      if not has_verified_evidence then
        raise exception 'This issue has no verified resolution evidence on file';
      end if;
    end if;

    update public.issues
    set status = p_next_status, updated_at = now(), version = version + 1
    where id = p_issue_id;

    insert into public.issue_events (issue_id, status, actor_id, note)
    values (p_issue_id, p_next_status, auth.uid(), nullif(trim(p_note), ''));
  end if;

  if p_severity is not null and p_severity <> current_row.severity then
    update public.issues
    set severity = p_severity, updated_at = now(), version = version + 1
    where id = p_issue_id;
  end if;

  if p_next_status is not null or p_severity is not null then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(), 'issue.status_change', 'issues', p_issue_id,
      jsonb_build_object(
        'from_status', current_row.status, 'to_status', p_next_status,
        'from_severity', current_row.severity, 'to_severity', p_severity,
        'note', p_note
      )
    );
  end if;
end;
$$;

revoke all on function public.update_issue_status(uuid, issue_status, issue_severity, text) from public;
grant execute on function public.update_issue_status(uuid, issue_status, issue_severity, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Route to a department. Bumps status to 'assigned' only when leaving
-- 'triaged', matching the previous client-side behavior.
-- ---------------------------------------------------------------------------
create or replace function public.route_issue_department(
  p_issue_id uuid,
  p_department_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status issue_status;
  next_status issue_status;
begin
  if not public.is_staff() then
    raise exception 'Only staff may route an issue to a department';
  end if;

  select status into current_status from public.issues where id = p_issue_id and deleted_at is null;
  if not found then
    raise exception 'Issue not found';
  end if;

  if not exists (select 1 from public.departments where id = p_department_id) then
    raise exception 'Department not found';
  end if;

  next_status := case when current_status = 'triaged' then 'assigned'::issue_status else current_status end;

  update public.issues
  set department_id = p_department_id, status = next_status, updated_at = now(), version = version + 1
  where id = p_issue_id;

  if next_status <> current_status then
    insert into public.issue_events (issue_id, status, actor_id, note)
    values (p_issue_id, next_status, auth.uid(), 'Routed to department.');
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'issue.route_department', 'issues', p_issue_id,
    jsonb_build_object('department_id', p_department_id, 'from_status', current_status, 'to_status', next_status)
  );
end;
$$;

revoke all on function public.route_issue_department(uuid, uuid) from public;
grant execute on function public.route_issue_department(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Mark as a duplicate of another report, looked up by its public tracking ID.
-- ---------------------------------------------------------------------------
create or replace function public.mark_issue_duplicate(
  p_issue_id uuid,
  p_duplicate_of_tracking_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status issue_status;
  target_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff may mark an issue as a duplicate';
  end if;

  select status into current_status from public.issues where id = p_issue_id and deleted_at is null;
  if not found then
    raise exception 'Issue not found';
  end if;

  if current_status not in ('reported', 'triaged') then
    raise exception 'Cannot mark an issue as a duplicate from status %', current_status;
  end if;

  select id into target_id from public.issues where tracking_id = upper(trim(p_duplicate_of_tracking_id));
  if target_id is null then
    raise exception 'No report found with tracking ID %', p_duplicate_of_tracking_id;
  end if;
  if target_id = p_issue_id then
    raise exception 'A report cannot be marked as a duplicate of itself';
  end if;

  update public.issues
  set status = 'duplicate', duplicate_of_issue_id = target_id, updated_at = now(), version = version + 1
  where id = p_issue_id;

  insert into public.issue_events (issue_id, status, actor_id, note)
  values (p_issue_id, 'duplicate', auth.uid(), 'Linked as a duplicate of ' || upper(trim(p_duplicate_of_tracking_id)) || '.');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'issue.mark_duplicate', 'issues', p_issue_id,
    jsonb_build_object('duplicate_of_issue_id', target_id)
  );
end;
$$;

revoke all on function public.mark_issue_duplicate(uuid, text) from public;
grant execute on function public.mark_issue_duplicate(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Close the gap these RPCs exist to fix: `issues_staff_update` (from
-- 20260829000200_rls_policies.sql) let ANY staff role UPDATE ANY column on
-- ANY issue directly from the browser — status, department, severity,
-- priority, duplicate link, all of it, with no transition check and no
-- audit trail. Every legitimate staff write now goes through the
-- SECURITY DEFINER RPCs above (which run with elevated privilege and bypass
-- RLS internally), so the blanket client-side UPDATE policy is no longer
-- needed and is actively the thing spec/ARCHITECTURE.md warns against.
-- ---------------------------------------------------------------------------
drop policy if exists issues_staff_update on public.issues;
