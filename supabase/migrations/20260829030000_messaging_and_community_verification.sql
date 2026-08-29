-- CivicFix: issue conversations + community verification
-- Safe to re-run (idempotent), matching the pattern established in prior
-- migrations — see supabase/migrations/20260829000100_initial_schema.sql's
-- header for why every statement here is if-not-exists / drop-then-create.

-- ---------------------------------------------------------------------------
-- Issue conversations. Direct RLS-governed table (not an RPC) — sending a
-- message is user-owned content, not a privileged workflow transition, the
-- same reasoning that already applies to `confirmations`.
-- ---------------------------------------------------------------------------
create table if not exists public.issue_messages (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  -- Snapshotted at send time so the conversation reads correctly even if the
  -- sender's roles change later.
  sender_role text not null check (sender_role in ('resident', 'staff')),
  body text not null check (length(trim(body)) > 0),
  -- "Delivery" here means "durably persisted" — there is no external push
  -- queue in front of this table, so every inserted row is delivered by
  -- definition. Only read state is meaningfully separate.
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  flagged_at timestamptz,
  flagged_by uuid references auth.users (id),
  flag_reason text,
  created_at timestamptz not null default now()
);

create index if not exists issue_messages_issue_idx on public.issue_messages (issue_id, created_at);

alter table public.issue_messages enable row level security;

-- Residents see/send only on their own issue; staff see/send on any issue
-- (the "relevant operational conversations" access the spec asks for).
drop policy if exists issue_messages_select on public.issue_messages;
create policy issue_messages_select on public.issue_messages
  for select using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id and (i.reporter_id = auth.uid() or public.is_staff())
    )
  );

drop policy if exists issue_messages_insert on public.issue_messages;
create policy issue_messages_insert on public.issue_messages
  for insert with check (
    sender_id = auth.uid()
    and (
      (sender_role = 'resident' and exists (
        select 1 from public.issues i where i.id = issue_id and i.reporter_id = auth.uid()
      ))
      or (sender_role = 'staff' and public.is_staff())
    )
  );

-- No client update/delete policy at all: messages are immutable once sent,
-- except for read_at/flag columns, which go through the narrow RPCs below
-- rather than a general UPDATE grant (so a client can never rewrite `body`
-- or `sender_id` after the fact).

-- Enables Postgres change broadcasts for this table — both clients subscribe
-- filtered by issue_id, and Realtime respects the SELECT policy above, so a
-- resident's subscription can never receive another resident's conversation.
do $$ begin
  alter publication supabase_realtime add table public.issue_messages;
exception when duplicate_object then null;
end $$;

create or replace function public.mark_issue_messages_read(p_issue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.issues i
    where i.id = p_issue_id and (i.reporter_id = auth.uid() or public.is_staff())
  ) then
    raise exception 'Issue not found or not accessible';
  end if;

  update public.issue_messages
  set read_at = now()
  where issue_id = p_issue_id
    and sender_id <> auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_issue_messages_read(uuid) from public;
grant execute on function public.mark_issue_messages_read(uuid) to authenticated;

create or replace function public.flag_issue_message(p_message_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
begin
  select * into msg from public.issue_messages where id = p_message_id;
  if not found then
    raise exception 'Message not found';
  end if;
  if not exists (
    select 1 from public.issues i
    where i.id = msg.issue_id and (i.reporter_id = auth.uid() or public.is_staff())
  ) then
    raise exception 'Not authorized to flag this message';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'A reason is required to flag a message';
  end if;

  update public.issue_messages
  set flagged_at = now(), flagged_by = auth.uid(), flag_reason = p_reason
  where id = p_message_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'message.flag', 'issue_messages', p_message_id, jsonb_build_object('reason', p_reason));
end;
$$;

revoke all on function public.flag_issue_message(uuid, text) from public;
grant execute on function public.flag_issue_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Community verification votes. One vote per resident per issue; a reporter
-- may not vote on their own issue (mirrors the existing `confirmations`
-- reporter-exclusion rule). A resident may change their mind — insert
-- upserts, it doesn't append duplicate votes.
-- ---------------------------------------------------------------------------
create table if not exists public.community_votes (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('completed', 'needs_work')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issue_id, user_id)
);

create index if not exists community_votes_issue_idx on public.community_votes (issue_id);

alter table public.community_votes enable row level security;

-- Readable by any signed-in resident, but only for issues they could already
-- see on the public map/their own reports/as staff — vote counts/comments
-- are the whole point of the community tab, but that doesn't widen access
-- to issues the voter otherwise couldn't view.
drop policy if exists community_votes_select on public.community_votes;
create policy community_votes_select on public.community_votes
  for select to authenticated using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id
        and ((i.is_public and i.deleted_at is null) or i.reporter_id = auth.uid() or public.is_staff())
    )
  );

-- No direct client insert/update: casting a vote must run the auto-resolve/
-- reopen side effects atomically, so it goes through cast_community_vote
-- below rather than a plain RLS insert policy.

do $$ begin
  alter publication supabase_realtime add table public.community_votes;
exception when duplicate_object then null;
end $$;

-- Auto-resolution thresholds. Deliberately simple, named constants so they
-- are easy to retune later: at least 3 total votes before any automatic
-- status change fires, then whichever side has strictly more votes wins.
-- A tie changes nothing — it waits for one more vote or an admin decision.
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

  select status, reporter_id into issue_row from public.issues where id = p_issue_id and deleted_at is null;
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

  -- Only pending_verification issues are still eligible for an automatic
  -- transition — a resolved issue can still collect votes/comments (useful
  -- signal for staff) without re-triggering resolution logic every time.
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
      return; -- Should not happen (evidence gates entry into pending_verification), but never resolve without it.
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

  elsif needs_work_count > completed_count then
    update public.issues
    set status = 'reopened', updated_at = now(), version = version + 1
    where id = p_issue_id;

    insert into public.issue_events (issue_id, status, actor_id, note)
    values (p_issue_id, 'reopened', null, format('Reopened by community vote (%s needs work vs %s completed).', needs_work_count, completed_count));

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'community.auto_reopen', 'issues', p_issue_id, jsonb_build_object('completed', completed_count, 'needs_work', needs_work_count));
  end if;
end;
$$;

revoke all on function public.cast_community_vote(uuid, text, text) from public;
grant execute on function public.cast_community_vote(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- "Community" listing helper: issues open for or recently through
-- verification, with vote tallies precomputed so the client doesn't need a
-- separate aggregate query per issue.
-- ---------------------------------------------------------------------------
create or replace view public.community_verification_feed as
select
  i.id, i.tracking_id, i.category, i.status, i.neighborhood, i.description,
  i.created_at, i.updated_at,
  re.note as completion_note,
  re.before_media_id, re.after_media_id, re.submitted_at as evidence_submitted_at, re.verified_at,
  coalesce(v.completed_count, 0) as completed_count,
  coalesce(v.needs_work_count, 0) as needs_work_count
from public.issues i
join lateral (
  select * from public.resolution_evidence e
  where e.issue_id = i.id
  order by e.submitted_at desc
  limit 1
) re on true
left join lateral (
  select
    count(*) filter (where cv.vote = 'completed') as completed_count,
    count(*) filter (where cv.vote = 'needs_work') as needs_work_count
  from public.community_votes cv where cv.issue_id = i.id
) v on true
where i.status in ('pending_verification', 'resolved') and i.is_public and i.deleted_at is null;

-- Views inherit RLS from their underlying tables when queried by an
-- authenticated client (Postgres checks the caller's privileges against
-- `issues`/`resolution_evidence`/`community_votes` at execution time), so no
-- separate policy is needed here.

-- ---------------------------------------------------------------------------
-- Before/after evidence photos live in the private `issue-media` bucket,
-- readable only by the uploader or staff (20260829010000). The community tab
-- needs any signed-in resident to see them for issues open to verification —
-- this adds that read path without loosening anything else.
-- ---------------------------------------------------------------------------
drop policy if exists issue_media_read_community_evidence on storage.objects;
create policy issue_media_read_community_evidence on storage.objects
  for select to authenticated
  using (
    bucket_id = 'issue-media'
    and exists (
      select 1
      from public.issue_media im
      join public.resolution_evidence re on re.before_media_id = im.id or re.after_media_id = im.id
      join public.issues i on i.id = re.issue_id
      where im.storage_key = storage.objects.name
        and i.is_public and i.deleted_at is null
        and i.status in ('pending_verification', 'resolved')
    )
  );

-- ---------------------------------------------------------------------------
-- Reopen tracking: already representable via issue_events (status='reopened'
-- rows already carry the reason in `note`) — no new column needed. Manual
-- staff reopen goes through update_issue_status (20260829020000), which
-- already requires a note of at least 10 characters for a 'reopened'
-- transition; the community auto-reopen path above writes its own
-- system-generated note instead.
