// Creates (or repairs) the CivicFix local/demo administrator account under
// Clerk + Convex.
//
// SECURITY: needs CLERK_SECRET_KEY (Clerk's backend API key) and
// SEED_ADMIN_SECRET (a value you set yourself via
// `npx convex env set SEED_ADMIN_SECRET <some-long-random-string>`). Never
// put either in a client bundle, never commit them, never deploy this
// demo account's credentials to production. This is a one-time local setup
// step, matching the instruction that a demo admin account be provisioned
// only through a seed script, never hardcoded in frontend code.
//
// Prerequisite (one-time, in the Clerk dashboard): enable "Username" as a
// sign-in identifier for your application — User & Authentication ->
// Email, Phone, Username -> turn on Username. Without this, Clerk rejects
// a username-only account.
//
// Usage (from the repo root, after `npx convex dev` has run at least once):
//   CLERK_SECRET_KEY=sk_... \
//   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud \
//   SEED_ADMIN_SECRET=... \
//   node scripts/seed-clerk-admin.mjs
//
// Optional overrides (defaults match the documented hackathon-demo account):
//   ADMIN_USERNAME=civicfix_admin_demo
//   ADMIN_PASSWORD=CivicFixDemo!2026
//   ADMIN_FULL_NAME="CivicFix Demo Administrator"

import { createClerkClient } from "@clerk/backend";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SEED_ADMIN_SECRET = process.env.SEED_ADMIN_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "civicfix_admin_demo";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "CivicFixDemo!2026";
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? "CivicFix Demo Administrator";

if (!CLERK_SECRET_KEY || !CONVEX_URL || !SEED_ADMIN_SECRET) {
  console.error(
    "Missing CLERK_SECRET_KEY, NEXT_PUBLIC_CONVEX_URL, or SEED_ADMIN_SECRET.\n" +
      "Run again as:\n" +
      "  CLERK_SECRET_KEY=... NEXT_PUBLIC_CONVEX_URL=... SEED_ADMIN_SECRET=... node scripts/seed-clerk-admin.mjs",
  );
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const convex = new ConvexHttpClient(CONVEX_URL);

const [firstName, ...rest] = ADMIN_FULL_NAME.split(" ");
const lastName = rest.join(" ") || undefined;

async function findExisting() {
  const { data } = await clerk.users.getUserList({ username: [ADMIN_USERNAME] });
  return data[0] ?? null;
}

async function main() {
  console.log(`Seeding demo administrator: ${ADMIN_USERNAME}`);

  let clerkUser = await findExisting();
  if (!clerkUser) {
    clerkUser = await clerk.users.createUser({
      username: ADMIN_USERNAME,
      // Clerk requires a real-TLD-shaped email address regardless of
      // username support being enabled — a made-up TLD like ".demo" fails
      // its format validator, so this uses the reserved example.com domain.
      emailAddress: [`${ADMIN_USERNAME}@example.com`],
      password: ADMIN_PASSWORD,
      firstName,
      lastName,
      skipPasswordChecks: false,
    });
    console.log(`Created Clerk user ${clerkUser.id}.`);
  } else {
    console.log(`Clerk user already exists (${clerkUser.id}) — updating password to match.`);
    await clerk.users.updateUser(clerkUser.id, { password: ADMIN_PASSWORD });
    console.log(`Password reset to: ${ADMIN_PASSWORD}`);
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${ADMIN_USERNAME}@example.com`;

  const userId = await convex.mutation(api.users.seedAdministrator, {
    clerkId: clerkUser.id,
    fullName: ADMIN_FULL_NAME,
    email,
    secret: SEED_ADMIN_SECRET,
  });

  console.log(`Convex user: ${userId}`);
  console.log("Done. Sign in at /admin-login with:");
  console.log(`  Username: ${ADMIN_USERNAME}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("This is a development/hackathon-demo account — rotate or remove it before any real deployment.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
