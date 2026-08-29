import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ensureConvexUser, getSessionProfile } from "@/lib/session";

/**
 * Landed on right after any sign-in (resident, staff, or admin). A full
 * navigation here (rather than a client-side redirect) guarantees the
 * server sees the just-created Clerk session before deciding where to send
 * the user — and ensureConvexUser makes sure a brand-new account has a
 * Convex `users` row before anything else queries it.
 */
export default async function PostSignInPage() {
  const clerkUser = await currentUser();
  await ensureConvexUser(
    clerkUser?.fullName ?? undefined,
    clerkUser?.primaryEmailAddress?.emailAddress ?? undefined,
  );

  const session = await getSessionProfile();
  const isDeskStaff = session?.roles.some((r) => ["department_manager", "administrator", "auditor"].includes(r));

  redirect(isDeskStaff ? "/admin" : "/app");
}
