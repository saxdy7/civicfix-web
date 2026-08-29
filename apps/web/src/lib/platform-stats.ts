import { createServerSupabase } from "./supabase-server";

export interface PlatformStats {
  reportsHandled: number;
  /** null (not 0) when there are no reports to compute a rate from — 0% would falsely read as "nothing gets resolved." */
  resolvedPct: number | null;
  activeResidents: number;
  /** null (not 0) when no issue has ever been triaged yet — 0h would falsely read as "instant triage." */
  medianTriageHours: number | null;
}

const EMPTY: PlatformStats = {
  reportsHandled: 0,
  resolvedPct: null,
  activeResidents: 0,
  medianTriageHours: null,
};

/**
 * Real platform-wide numbers for marketing surfaces (landing page, auth
 * showcase). A brand-new deployment legitimately reports zero rather than
 * showing invented traction — never hardcode these.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = await createServerSupabase();
  if (!supabase) return EMPTY;

  const [{ count: total }, { count: resolved }, { data: reporterRows }, { data: events }] =
    await Promise.all([
      supabase.from("issues").select("id", { count: "exact", head: true }),
      supabase.from("issues").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("issues").select("reporter_id"),
      supabase
        .from("issue_events")
        .select("issue_id, status, created_at")
        .in("status", ["reported", "triaged"])
        .order("created_at", { ascending: true }),
    ]);

  const activeResidents = new Set((reporterRows ?? []).map((r) => r.reporter_id).filter(Boolean))
    .size;

  const firstSeen = new Map<string, { reported?: string; triaged?: string }>();
  (events ?? []).forEach((e) => {
    const entry = firstSeen.get(e.issue_id) ?? {};
    if (e.status === "reported" && !entry.reported) entry.reported = e.created_at;
    if (e.status === "triaged" && !entry.triaged) entry.triaged = e.created_at;
    firstSeen.set(e.issue_id, entry);
  });

  const triageHours = [...firstSeen.values()]
    .filter((e) => e.reported && e.triaged)
    .map((e) => (new Date(e.triaged!).getTime() - new Date(e.reported!).getTime()) / 3_600_000)
    .sort((a, b) => a - b);

  const totalCount = total ?? 0;

  return {
    reportsHandled: totalCount,
    resolvedPct: totalCount ? ((resolved ?? 0) / totalCount) * 100 : null,
    activeResidents,
    medianTriageHours: triageHours.length ? triageHours[Math.floor(triageHours.length / 2)] : null,
  };
}
