import { ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;

/**
 * True when Convex is configured. When false, auth-context and the
 * repositories fall back to clearly-labelled local demo data — see
 * lib/demo-data.ts and components/DemoBanner.tsx. Never treat missing
 * config as "sign in anyway".
 */
export const isConvexConfigured = Boolean(url);

/**
 * Same Convex deployment the web app talks to — set EXPO_PUBLIC_CONVEX_URL
 * to the exact value `npx convex dev`/`npx convex deploy` printed for
 * NEXT_PUBLIC_CONVEX_URL. On a physical device or Android emulator,
 * `http://127.0.0.1:...` from a local `convex dev` run is only reachable
 * from the machine it's running on — use that machine's LAN IP (or a
 * deployed Convex URL) instead when testing on a real device.
 */
export const convexClient = isConvexConfigured ? new ConvexReactClient(url as string) : null;

/**
 * True only when BOTH Clerk and Convex are configured — the exact condition
 * app/_layout.tsx's BackendProviders uses to decide whether to mount
 * ConvexProviderWithClerk at all. Any component calling Convex's
 * useQuery/useMutation hooks (not the imperative convexClient.query/mutation
 * calls the repositories use) must gate on this before rendering — those
 * hooks require a ConvexProvider ancestor even when passed the "skip"
 * sentinel, so they crash outside that tree.
 */
export const isBackendConfigured = isConvexConfigured && Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** Extracts the thrown-string message from a Convex mutation/query's ConvexError, or falls back generically. */
export function convexErrorMessage(err: unknown): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : "Something went wrong.";
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}
