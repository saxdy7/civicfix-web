import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";

import { api } from "@convex/_generated/api";

const DESK_STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"];
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
  const res = NextResponse.next();
  // Clear any legacy Supabase cookies lingering in the browser to prevent 431 header bloat
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) {
      res.cookies.delete(cookie.name);
    }
  }

  const path = req.nextUrl.pathname;
  if (!isAppRoute(req) && !isAdminRoute(req)) return res;

  const { userId, getToken, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  if (isAdminRoute(req)) {
    let viewer = null;
    try {
      const token = await getToken({ template: "convex" });
      if (token) {
        viewer = await fetchQuery(api.users.viewer, {}, { token });
      }
    } catch (err) {
      console.warn("[middleware] Viewer role query failed:", err);
    }

    const roles = viewer?.roles ?? [];
    const hasDeskRole = roles.some((r) => DESK_STAFF_ROLES.includes(r));

    if (!hasDeskRole) {
      return NextResponse.redirect(new URL("/app", req.url));
    }
    if (ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p)) && !roles.includes("administrator")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return res;
});

export const config = {
  /*
   * Match ALL routes except:
   *  - Next.js static files (_next/static, _next/image)
   *  - favicon and other public root assets
   * This ensures clerkMiddleware() runs on every page/route that could call
   * auth(), regardless of whether it is a protected route.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
