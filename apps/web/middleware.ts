import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"];
const ADMIN_ONLY_PREFIXES = ["/admin/users", "/admin/access-requests"];

/**
 * Route guard for the two authenticated portals:
 *  - /app/**   requires any signed-in user
 *  - /admin/** additionally requires a staff role (from user_roles, never
 *    from client-editable user_metadata)
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
    const isStaff = roles.some((r) => STAFF_ROLES.includes(r));

    if (!isStaff) return NextResponse.redirect(new URL("/app", request.url));

    if (ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p)) && !roles.includes("administrator")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};
