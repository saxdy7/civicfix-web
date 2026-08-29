import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Desk roles get the full web admin console. Field workers do their actual
// job (accept assignment, submit before/after evidence, chat) exclusively
// on mobile — there is no field-worker UI on web at all — so holding only
// this role does not grant /admin access; see isFieldWorkerOnly below.
const DESK_STAFF_ROLES = ["department_manager", "administrator", "auditor"];
const ADMIN_ONLY_PREFIXES = ["/admin/users", "/admin/access-requests"];

/**
 * Route guard for the two authenticated portals:
 *  - /app/**   requires any signed-in user
 *  - /admin/** additionally requires a desk staff role (from user_roles,
 *    never from client-editable user_metadata) — a field-worker-only
 *    account is redirected to a page explaining mobile is where their work
 *    happens, not into a console with nothing built for their role.
 *  - /admin/users and /admin/access-requests additionally require the
 *    administrator role specifically — these manage who has privileged
 *    access at all, so a department manager or auditor signing in doesn't
 *    land on a page that looks like it's theirs to act on but silently
 *    can't (the RPCs already enforce is_admin(); this just stops the UI
 *    from pretending otherwise).
 *
 * Fails closed: if Supabase isn't configured at all, protected routes are
 * unreachable rather than silently open.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/admin") || path.startsWith("/app");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    if (isProtected) return NextResponse.redirect(new URL("/sign-in", request.url));
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isProtected) return response;

  if (!user) {
    // Field workers and department managers reach /admin/** through the
    // regular resident-style sign-in (their own email/password) — only
    // `administrator` accounts use the separate UID login at /admin-login,
    // reached via an explicit link rather than this default redirect, so
    // non-admin staff bookmarking an admin URL aren't shown a login form
    // that doesn't apply to them.
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (path.startsWith("/admin")) {
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const hasDeskRole = roles.some((r) => DESK_STAFF_ROLES.includes(r));

    if (!hasDeskRole) {
      const isFieldWorkerOnly = roles.includes("field_worker");
      return NextResponse.redirect(new URL(isFieldWorkerOnly ? "/staff/mobile-only" : "/app", request.url));
    }

    if (ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p)) && !roles.includes("administrator")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};
