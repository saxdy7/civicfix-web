-- CivicFix: let staff verify resolution evidence directly.
--
-- The only thing that ever set `resolution_evidence.verified_at` was
-- `cast_community_vote`'s auto-resolve path (3+ residents voting
-- "completed"). `update_issue_status` already requires verified evidence
-- before allowing a move to 'resolved', which meant there was no way for
-- staff to resolve an issue on their own authority at all — only residents,
-- and only if enough of them ever visited the Community tab to vote. This
-- adds the missing staff-driven verification step; community voting is
-- unchanged and still works as an independent, additional path.

create or replace function public.verify_resolution_evidence(p_evidence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
begin
  if not public.is_staff() then
    raise exception 'Only staff may verify resolution evidence';
  end if;

  select id, issue_id, verified_at into ev from public.resolution_evidence where id = p_evidence_id;
  if not found then
    raise exception 'Evidence not found';
  end if;
  if ev.verified_at is not null then
    raise exception 'This evidence is already verified';
  end if;

  update public.resolution_evidence
  set verified_by = auth.uid(), verified_at = now()
  where id = p_evidence_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'evidence.verify', 'resolution_evidence', p_evidence_id, jsonb_build_object('issue_id', ev.issue_id));
end;
$$;

revoke all on function public.verify_resolution_evidence(uuid) from public;
grant execute on function public.verify_resolution_evidence(uuid) to authenticated;
