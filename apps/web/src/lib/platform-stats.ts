import { fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";

export interface PlatformStats {
  reportsHandled: number;
  /** null (not 0) when there are no reports to compute a rate from — 0% would falsely read as "nothing gets resolved." */
  resolvedPct: number | null;
  activeResidents: number;
  /** null (not 0) when no issue has ever been triaged yet — 0h would falsely read as "instant triage." */
  medianTriageHours: number | null;
}

/**
 * Real platform-wide numbers for marketing surfaces (landing page, auth
 * showcase). A brand-new deployment legitimately reports zero rather than
 * showing invented traction — never hardcode these. Public data only (no
 * auth token needed — issues.list already scopes to public rows for an
 * unauthenticated caller).
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const issues = await fetchQuery(api.issues.list, {});

  const totalCount = issues.length;
  const resolvedCount = issues.filter((i) => i.status === "resolved").length;
  const activeResidents = new Set(issues.map((i) => i.reporterId)).size;

  const triageHours = await Promise.all(
    issues.map(async (issue) => {
      const events = (await fetchQuery(api.issues.getById, { issueId: issue._id }))?.events ?? [];
      const reported = events.find((e) => e.status === "reported")?.createdAt;
      const triaged = events.find((e) => e.status === "triaged")?.createdAt;
      if (!reported || !triaged) return null;
      return (triaged - reported) / 3_600_000;
    }),
  );
  const sortedHours = triageHours.filter((h): h is number => h !== null).sort((a, b) => a - b);

  return {
    reportsHandled: totalCount,
    resolvedPct: totalCount ? (resolvedCount / totalCount) * 100 : null,
    activeResidents,
    medianTriageHours: sortedHours.length ? sortedHours[Math.floor(sortedHours.length / 2)] : null,
  };
}
