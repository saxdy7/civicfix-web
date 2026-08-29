import { convexClient } from "../convex-client";

import { api } from "../../../../convex/_generated/api";

export interface PlatformStats {
  resolved: number;
  avgResponseHours: number | null;
  confirmations: number;
  /** True when these are the labelled local fallback, never real counts. */
  isDemo: boolean;
}

const DEMO_STATS: PlatformStats = { resolved: 12, avgResponseHours: 36, confirmations: 41, isDemo: true };

/**
 * Real, platform-wide numbers for the landing page's "live impact" section.
 * A brand-new deployment legitimately shows zero — never invent traction.
 * "Confirmations" now reflects total community votes cast (the closest
 * surviving analog to the retired per-report confirmation feature).
 */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  if (!convexClient) return DEMO_STATS;

  try {
    const [issues, feed] = await Promise.all([
      convexClient.query(api.issues.list, {}),
      convexClient.query(api.communityVotes.feed, {}),
    ]);

    const resolved = issues.filter((i) => i.status === "resolved");
    const avgResponseHours = resolved.length
      ? resolved.reduce((sum, i) => sum + (i.updatedAt - i.createdAt) / 3_600_000, 0) / resolved.length
      : null;
    const confirmations = feed.reduce((sum, f) => sum + f.completedCount + f.needsWorkCount, 0);

    return { resolved: resolved.length, avgResponseHours, confirmations, isDemo: false };
  } catch {
    return DEMO_STATS;
  }
}
