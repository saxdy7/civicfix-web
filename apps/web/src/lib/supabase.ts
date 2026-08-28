import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True when Supabase env vars are present. The UI falls back to its preview
 * behaviour (mock data, no real session) when this is false, so the site still
 * runs for anyone who has not configured credentials.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

// Cookie-backed (not localStorage) so the session is visible to middleware
// and server components — required for the /admin and /app route guards.
export const supabase = isSupabaseConfigured
  ? createBrowserClient(url as string, publishableKey as string)
  : null;

/** Human-readable message for a Supabase auth error. */
export function authErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}
