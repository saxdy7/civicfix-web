-- CivicFix: AI-assisted intake, real notification delivery, automated
-- duplicate detection, and recurring-hotspot detection.
--
-- Context: `ai_assessments`/`notifications` tables and the manual-only
-- `mark_issue_duplicate` RPC already existed, but nothing ever wrote a real
-- AI assessment, nothing ever inserted a notification row (the previous
-- migration's own comment said so explicitly), and there was no automated
-- way to surface nearby/similar reports. This migration closes all three
-- gaps with plain SQL — no cron job or edge function required, so it works
-- immediately once applied.

-- ---------------------------------------------------------------------------
-- Record an AI triage assessment (called by the Next.js server route right
-- after a client-side AI suggestion is shown) and, when confident enough,
-- auto-route the issue to the matching department. Callable by the issue's
-- own reporter (the normal path, right after they submit) or by staff.
-- ---------------------------------------------------------------------------
create or replace function public.record_ai_assessment(
  p_issue_id uuid,
  p_category issue_category,
  p_severity issue_severity,
  p_confidence numeric,
  p_reasoning text,
  p_provider text default 'groq',
  p_model text default 'unknown'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row record;
  target_department record;
begin
  select reporter_id, department_id, status into issue_row from public.issues where id = p_issue_id and deleted_at is null;
  if not found then
    raise exception 'Issue not found';
  end if;

  if auth.uid() is null or (auth.uid() <> issue_row.reporter_id and not public.is_staff()) then
    raise exception 'Not authorized to record an assessment for this issue';
  end if;

  insert into public.ai_assessments (issue_id, provider, model, prompt_version, input_hash, output, confidence)
  values (
    p_issue_id, p_provider, p_model, 'v1', md5(p_issue_id::text || now()::text),
    jsonb_build_object('category', p_category, 'severity', p_severity, 'reasoning', p_reasoning),
    p_confidence
  );

  -- Auto-route only a fresh, still-unrouted report, and only when confident.
  if p_confidence >= 0.75 and issue_row.department_id is null and issue_row.status = 'reported' then
    select id, name into target_department
    from public.departments
    where p_category = any(categories)
    limit 1;

    if found then
      update public.issues set department_id = target_department.id, updated_at = now() where id = p_issue_id;

      insert into public.issue_events (issue_id, status, actor_id, note)
      values (p_issue_id, 'reported', null, format('Auto-routed to %s by AI triage (%s%% confidence).', target_department.name, round(p_confidence * 100)));

      insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'ai.auto_route', 'issues', p_issue_id, jsonb_build_object('department_id', target_department.id, 'confidence', p_confidence));
    end if;
  end if;
end;
$$;

revoke all on function public.record_ai_assessment(uuid, issue_category, issue_severity, numeric, text, text, text) from public;
grant execute on function public.record_ai_assessment(uuid, issue_category, issue_severity, numeric, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nearby/similar open reports — read-only, no SECURITY DEFINER needed since
-- it only returns fields already visible on the public map for public,
-- non-deleted, still-open issues. Used both by the report form (before
-- submit: "is this already reported?") and by staff triage (duplicate
-- suggestions instead of typing a tracking ID blind).
-- ---------------------------------------------------------------------------
create or replace function public.find_nearby_similar_issues(
  p_latitude double precision,
  p_longitude double precision,
  p_category issue_category,
  p_radius_m integer default 200,
  p_exclude_issue_id uuid default null
)
returns table (
  id uuid,
  tracking_id text,
  description text,
  status issue_status,
  distance_m double precision,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    i.id, i.tracking_id, i.description, i.status,
    ST_Distance(i.location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography) as distance_m,
    i.created_at
  from public.issues i
  where i.is_public
    and i.deleted_at is null
    and i.category = p_category
    and i.status not in ('resolved', 'rejected', 'duplicate')
    and (p_exclude_issue_id is null or i.id <> p_exclude_issue_id)
    and ST_DWithin(i.location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, p_radius_m)
  order by distance_m asc
  limit 5;
$$;

revoke all on function public.find_nearby_similar_issues(double precision, double precision, issue_category, integer, uuid) from public;
grant execute on function public.find_nearby_similar_issues(double precision, double precision, issue_category, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Recurring hotspots: locations (grid cells, ~300m) with 3+ reports of the
-- same category over time — distinct from same-moment duplicate detection
-- above, which only looks at currently-open reports. This looks across all
-- reports regardless of status, so a spot that keeps recurring even after
-- being "fixed" each time still shows up.
-- ---------------------------------------------------------------------------
create or replace view public.recurring_hotspots as
select
  category,
  ST_Y(ST_Centroid(ST_Collect(location::geometry))) as latitude,
  ST_X(ST_Centroid(ST_Collect(location::geometry))) as longitude,
  count(*) as report_count,
  min(created_at) as first_reported_at,
  max(created_at) as last_reported_at,
  (array_agg(neighborhood order by created_at desc) filter (where neighborhood is not null))[1] as neighborhood
from public.issues
where is_public and deleted_at is null
group by category, ST_SnapToGrid(location::geometry, 0.003)
having count(*) >= 3
order by count(*) desc;

-- ---------------------------------------------------------------------------
-- Real-time notifications. Every function below is re-declared with its
-- prior body intact plus a notification insert for whoever needs to know.
-- Actors never notify themselves.
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
  notif_title text;
  notif_body text;
begin
  if not public.is_staff() then
    raise exception 'Only staff may change an issue''s status or severity';
  end if;

  select status, severity, reporter_id, tracking_id into current_row from public.issues where id = p_issue_id and deleted_at is null;
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

    if current_row.reporter_id is not null and current_row.reporter_id <> auth.uid() then
      notif_title := case p_next_status
        when 'triaged' then 'Your report is being reviewed'
        when 'assigned' then 'Work has been assigned'
        when 'in_progress' then 'Work has started'
        when 'pending_verification' then 'Ready for your review'
        when 'resolved' then 'Report resolved'
        when 'reopened' then 'Report reopened'
        when 'rejected' then 'Report closed'
        when 'duplicate' then 'Linked as a duplicate'
        else 'Report updated'
      end;
      notif_body := case p_next_status
        when 'pending_verification' then format('%s has repair evidence submitted — check the Community tab to confirm it''s fixed.', current_row.tracking_id)
        when 'resolved' then format('%s has been marked resolved.', current_row.tracking_id)
        when 'reopened' then format('%s was reopened: %s', current_row.tracking_id, coalesce(nullif(trim(p_note), ''), 'more work is needed.'))
        when 'rejected' then format('%s was closed: %s', current_row.tracking_id, coalesce(nullif(trim(p_note), ''), 'not actionable.'))
        else format('%s is now: %s', current_row.tracking_id, p_next_status::text)
      end;

      insert into public.notifications (user_id, issue_id, title, body)
      values (current_row.reporter_id, p_issue_id, notif_title, notif_body);
    end if;
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

create or replace function public.assign_worker(
  p_issue_id uuid,
  p_worker_id uuid,
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
  reporter uuid;
  tracking text;
begin
  if not public.is_staff() then
    raise exception 'Only staff may assign a field worker';
  end if;

  if not exists (
    select 1 from public.user_roles where user_id = p_worker_id and role = 'field_worker'
  ) then
    raise exception 'Target user is not a field worker';
  end if;

  select status, reporter_id, tracking_id into current_status, reporter, tracking from public.issues where id = p_issue_id;
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

    if reporter is not null and reporter <> auth.uid() then
      insert into public.notifications (user_id, issue_id, title, body)
      values (reporter, p_issue_id, 'Work has been assigned', format('A field worker has been assigned to %s.', tracking));
    end if;
  end if;

  if p_worker_id <> auth.uid() then
    insert into public.notifications (user_id, issue_id, title, body)
    values (p_worker_id, p_issue_id, 'New assignment', format('You have been assigned to %s, due %s.', tracking, to_char(p_due_at, 'Mon DD, HH12:MI AM')));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'assignment.create', 'assignments', new_assignment_id,
    jsonb_build_object('issue_id', p_issue_id, 'worker_id', p_worker_id)
  );

  return new_assignment_id;
end;
$$;

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
  reporter uuid;
  tracking text;
  dept_name text;
begin
  if not public.is_staff() then
    raise exception 'Only staff may route an issue to a department';
  end if;

  select status, reporter_id, tracking_id into current_status, reporter, tracking from public.issues where id = p_issue_id and deleted_at is null;
  if not found then
    raise exception 'Issue not found';
  end if;

  select name into dept_name from public.departments where id = p_department_id;
  if dept_name is null then
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

  if reporter is not null and reporter <> auth.uid() then
    insert into public.notifications (user_id, issue_id, title, body)
    values (reporter, p_issue_id, 'Report routed', format('%s was routed to %s.', tracking, dept_name));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'issue.route_department', 'issues', p_issue_id,
    jsonb_build_object('department_id', p_department_id, 'from_status', current_status, 'to_status', next_status)
  );
end;
$$;

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
  reporter uuid;
  tracking text;
  target_id uuid;
  target_tracking text;
begin
  if not public.is_staff() then
    raise exception 'Only staff may mark an issue as a duplicate';
  end if;

  select status, reporter_id, tracking_id into current_status, reporter, tracking from public.issues where id = p_issue_id and deleted_at is null;
  if not found then
    raise exception 'Issue not found';
  end if;

  if current_status not in ('reported', 'triaged') then
    raise exception 'Cannot mark an issue as a duplicate from status %', current_status;
  end if;

  target_tracking := upper(trim(p_duplicate_of_tracking_id));
  select id into target_id from public.issues where tracking_id = target_tracking;
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
  values (p_issue_id, 'duplicate', auth.uid(), 'Linked as a duplicate of ' || target_tracking || '.');

  if reporter is not null and reporter <> auth.uid() then
    insert into public.notifications (user_id, issue_id, title, body)
    values (reporter, p_issue_id, 'Linked as a duplicate', format('%s was linked to an existing report (%s) that''s already being tracked.', tracking, target_tracking));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'issue.mark_duplicate', 'issues', p_issue_id,
    jsonb_build_object('duplicate_of_issue_id', target_id)
  );
end;
$$;

-- Community-vote auto-resolve/auto-reopen: same function, same behavior,
-- plus a notification to the reporter for both outcomes.
create or replace function public.cast_community_vote(
  p_issue_id uuid,
  p_vote text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row record;
  is_reporter boolean;
  has_evidence boolean;
  completed_count integer;
  needs_work_count integer;
  total_count integer;
begin
  if p_vote not in ('completed', 'needs_work') then
    raise exception 'Invalid vote';
  end if;

  select status, reporter_id, tracking_id into issue_row from public.issues where id = p_issue_id and deleted_at is null;
  if not found then
    raise exception 'Issue not found';
  end if;

  if issue_row.status not in ('pending_verification', 'resolved') then
    raise exception 'This issue is not open for community verification';
  end if;

  is_reporter := issue_row.reporter_id = auth.uid();
  if is_reporter then
    raise exception 'You cannot vote on your own report';
  end if;

  insert into public.community_votes (issue_id, user_id, vote, comment)
  values (p_issue_id, auth.uid(), p_vote, nullif(trim(p_comment), ''))
  on conflict (issue_id, user_id)
  do update set vote = excluded.vote, comment = excluded.comment, updated_at = now();

  if issue_row.status <> 'pending_verification' then
    return;
  end if;

  select count(*) filter (where vote = 'completed'), count(*) filter (where vote = 'needs_work'), count(*)
    into completed_count, needs_work_count, total_count
    from public.community_votes where issue_id = p_issue_id;

  if total_count < 3 then
    return;
  end if;

  if completed_count > needs_work_count then
    select exists (select 1 from public.resolution_evidence where issue_id = p_issue_id) into has_evidence;
    if not has_evidence then
      return;
    end if;

    update public.resolution_evidence
    set verified_at = now()
    where issue_id = p_issue_id and verified_at is null;

    update public.issues
    set status = 'resolved', updated_at = now(), version = version + 1
    where id = p_issue_id;

    insert into public.issue_events (issue_id, status, actor_id, note)
    values (p_issue_id, 'resolved', null, format('Verified by community vote (%s completed vs %s needs work).', completed_count, needs_work_count));

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'community.auto_resolve', 'issues', p_issue_id, jsonb_build_object('completed', completed_count, 'needs_work', needs_work_count));

    if issue_row.reporter_id is not null then
      insert into public.notifications (user_id, issue_id, title, body)
      values (issue_row.reporter_id, p_issue_id, 'Verified resolved', format('Your neighbors confirmed %s is fixed.', issue_row.tracking_id));
    end if;

  elsif needs_work_count > completed_count then
    update public.issues
    set status = 'reopened', updated_at = now(), version = version + 1
    where id = p_issue_id;

    insert into public.issue_events (issue_id, status, actor_id, note)
    values (p_issue_id, 'reopened', null, format('Reopened by community vote (%s needs work vs %s completed).', needs_work_count, completed_count));

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'community.auto_reopen', 'issues', p_issue_id, jsonb_build_object('completed', completed_count, 'needs_work', needs_work_count));

    if issue_row.reporter_id is not null then
      insert into public.notifications (user_id, issue_id, title, body)
      values (issue_row.reporter_id, p_issue_id, 'Reopened after review', format('Neighbors flagged %s as still needing work.', issue_row.tracking_id));
    end if;
  end if;
end;
$$;

-- Live badge/list updates on both clients without polling.
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
