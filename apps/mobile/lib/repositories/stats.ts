import { supabase } from "../supabase";

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
 */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  if (!supabase) return DEMO_STATS;

  const [{ count: resolved }, { count: confirmations }, { data: events }] = await Promise.all([
    supabase.from("issues").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("confirmations").select("id", { count: "exact", head: true }),
    supabase
      .from("issue_events")
      .select("issue_id, status, created_at")
      .in("status", ["reported", "triaged"])
      .order("created_at", { ascending: true }),
  ]);

  const firstSeen = new Map<string, { reported?: string; triaged?: string }>();
  (events ?? []).forEach((e) => {
    const entry = firstSeen.get(e.issue_id) ?? {};
    if (e.status === "reported" && !entry.reported) entry.reported = e.created_at;
    if (e.status === "triaged" && !entry.triaged) entry.triaged = e.created_at;
    firstSeen.set(e.issue_id, entry);
  });

  const hours = [...firstSeen.values()]
    .filter((e) => e.reported && e.triaged)
    .map((e) => (new Date(e.triaged!).getTime() - new Date(e.reported!).getTime()) / 3_600_000);

  return {
    resolved: resolved ?? 0,
    avgResponseHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    confirmations: confirmations ?? 0,
    isDemo: false,
  };
}
