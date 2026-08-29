// Tells Convex to accept Clerk-issued JWTs. CLERK_JWT_ISSUER_DOMAIN is set
// via `npx convex env set` (or the Convex dashboard), never committed —
// it's your Clerk instance's Frontend API URL, e.g.
// https://dashing-mustang-3814.clerk.accounts.dev (from the publishable key
// in apps/web/.env.local: pk_test_<base64 of that domain>).
export default {
  providers: [
    {
      domain:
        process.env.CLERK_JWT_ISSUER_DOMAIN ||
        "https://dashing-mustang-3814.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
