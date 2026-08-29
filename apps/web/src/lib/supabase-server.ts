import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isSupabaseConfigured } from "./supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Server Component / server action client. Reads the session from cookies
 * set by middleware — never holds a service-role key (that stays in FastAPI).
 * Returns null in preview mode (no Supabase env configured), matching the
 * browser client's fallback so pages can render the same way in both.
 */
export async function createServerSupabase() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(url as string, publishableKey as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — middleware already
          // refreshes the session cookie on every request, so this is safe.
        }
      },
    },
  });
}

const STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"];

export interface SessionProfile {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
  createdAt: string;
}

/** Resolves the signed-in user's profile + roles, or null if unauthenticated/unconfigured. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as string);

  return {
    userId: user.id,
    name: profile?.full_name || user.email?.split("@")[0] || "Resident",
    email: profile?.email || user.email || "",
    roles,
    isStaff: roles.some((r) => STAFF_ROLES.includes(r)),
    isAdmin: roles.includes("administrator"),
    createdAt: user.created_at,
  };
}
