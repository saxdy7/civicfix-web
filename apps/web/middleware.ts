import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";

import { api } from "@convex/_generated/api";

const DESK_STAFF_ROLES = ["department_manager", "administrator", "auditor"];
const ADMIN_ONLY_PREFIXES = ["/admin/users", "/admin/access-requests"];

const isAppRoute = createRouteMatcher(["/app(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

/**
 * Route guard for the two authenticated portals:
 *  - /app/**   requires any signed-in Clerk user
 *  - /admin/** additionally requires a desk staff role, read from Convex
 *    (never from Clerk's client-editable public/unsafe metadata)
 *  - /admin/users and /admin/access-requests additionally require the
 *    administrator role specifically.
 */
export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  if (!isAppRoute(req) && !isAdminRoute(req)) return NextResponse.next();

  const { userId, getToken, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  if (isAdminRoute(req)) {
    const token = await getToken({ template: "convex" });
    const viewer = await fetchQuery(api.users.viewer, {}, { token: token ?? undefined });
    const roles = viewer?.roles ?? [];
    const hasDeskRole = roles.some((r) => DESK_STAFF_ROLES.includes(r));

    if (!hasDeskRole) {
      return NextResponse.redirect(new URL("/app", req.url));
    }
    if (ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p)) && !roles.includes("administrator")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};
