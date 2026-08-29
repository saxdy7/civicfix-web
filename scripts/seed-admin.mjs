// Creates (or repairs) the CivicFix local/demo administrator account.
//
// SECURITY: this script needs your Supabase project's SERVICE ROLE key,
// which bypasses RLS entirely. Never put that key in any client bundle
// (mobile or web), never commit it, and never run this script anywhere
// except your own machine against a project you control. It is not part of
// the app's runtime — it is a one-time local setup step, matching the
// instruction that a demo admin account be provisioned "only through a seed
// script or documented local setup," never hardcoded in frontend code.
//
// Usage (from the repo root):
//   SUPABASE_URL=https://your-project.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/seed-admin.mjs
//
// Optional overrides (defaults match the documented hackathon-demo account):
//   ADMIN_UID=civicfix.admin.demo
//   ADMIN_PASSWORD=CivicFixDemo!2026
//   ADMIN_FULL_NAME="CivicFix Demo Administrator"
//
// The "UID" is a convention, not a real email: the admin login screen
// (apps/web/src/app/admin/login) takes a UID and internally signs in as
// `${uid}@local.test`. That suffix is fixed and must match
// apps/web/src/app/admin/login/AdminLoginForm.tsx exactly.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_UID = process.env.ADMIN_UID ?? "civicfix.admin.demo";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "CivicFixDemo!2026";
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? "CivicFix Demo Administrator";
const ADMIN_EMAIL = `${ADMIN_UID}@local.test`;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Find both in your Supabase project: Settings -> API.\n" +
      "Run again as:\n" +
      "  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-admin.mjs",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  // admin.listUsers() paginates; the demo/dev user base is small enough that
  // one page is always sufficient here.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function main() {
  console.log(`Seeding demo administrator: UID "${ADMIN_UID}" -> ${ADMIN_EMAIL}`);

  let user = await findUserByEmail(ADMIN_EMAIL);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_FULL_NAME },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created auth user ${user.id}.`);
  } else {
    console.log(`Auth user already exists (${user.id}) — leaving password as-is.`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, full_name: ADMIN_FULL_NAME, email: ADMIN_EMAIL }, { onConflict: "id" });
  if (profileError) throw profileError;

  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role: "administrator" }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;

  console.log("Done. Sign in at /admin/login with:");
  console.log(`  Admin UID: ${ADMIN_UID}`);
  console.log(`  Password:  ${ADMIN_PASSWORD}`);
  console.log("This is a development/hackathon-demo account — rotate or remove it before any real deployment.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
