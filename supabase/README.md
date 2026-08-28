# Supabase — schema and policies

Project ref: `ncmobcptkjrbqvzmfyzk`

## Files

| File | Purpose |
|---|---|
| `migrations/20260829000100_initial_schema.sql` | Enums, tables, indexes, and the signup trigger that assigns every new user the `citizen` role server-side. |
| `migrations/20260829000200_rls_policies.sql` | Row Level Security: role helpers plus a policy set per table. |
| `seed.sql` | The four default departments. |

## Applying them

Either path works — both need credentials this repo does not contain.

**Supabase CLI (recommended)**

```bash
npx supabase login
npx supabase link --project-ref ncmobcptkjrbqvzmfyzk
npx supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql   # optional seed
```

**SQL editor**

Paste each migration into the Supabase dashboard SQL editor in filename order,
then `seed.sql`.

## Security model

- **Roles never live in `user_metadata`.** They live in `public.user_roles`, which no
  client policy can write to. The only automatic grant is `citizen`, issued by the
  `on_auth_user_created` trigger.
- **Staff cannot self-elevate.** `staff_access_requests` accepts only `field_worker`
  or `department_manager` (CHECK constraint), only for the requesting user, and only
  as `pending`. Approval requires `is_admin()`, and a CHECK blocks self-approval.
  `administrator` and `auditor` are not requestable at all.
- **The audit log is append-only** — `UPDATE` and `DELETE` are blocked by rules, not
  just policy.
- **Role helpers are `SECURITY DEFINER`** so policies can read `user_roles` without
  recursing through its own RLS.

FastAPI stays the authority on which workflow transitions are legal; RLS bounds what a
client holding a user JWT could ever reach directly.

## Still to configure

- **Municipal email allowlist** for staff requests (e.g. `@city.gov`) — enforce in
  FastAPI and surface a warning to the reviewing admin.
- **The first administrator** must be granted by hand, since the trigger only ever
  issues `citizen`:

  ```sql
  insert into public.user_roles (user_id, role)
  values ('<your-auth-user-uuid>', 'administrator');
  ```
