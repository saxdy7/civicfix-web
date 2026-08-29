-- Backfill profiles/user_roles rows for any auth.users row created before
-- the on_auth_user_created trigger (20260829000100) existed, or otherwise
-- missing a row today. Idempotent — only inserts where nothing exists yet,
-- never overwrites an existing profile or role.

insert into public.profiles (id, full_name, email)
select u.id, u.raw_user_meta_data ->> 'full_name', u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into public.user_roles (user_id, role)
select u.id, 'citizen'
from auth.users u
left join public.user_roles r on r.user_id = u.id
where r.user_id is null;
