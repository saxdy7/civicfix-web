import { fetchQuery } from "convex/nextjs";

import { PublicShell } from "@/components/PublicShell";
import { mapConvexIssue } from "@/lib/issue-mappers";
import { MOCK_ISSUES } from "@/lib/mock-data";
import type { Issue } from "@/lib/types";

import { api } from "@convex/_generated/api";

import { MapExplorer } from "./MapExplorer";
import styles from "./page.module.css";

export default async function PublicMapPage() {
  // No token needed — issues.list already restricts an anonymous caller to
  // public, non-deleted rows server-side (see convex/issues.ts).
  const [issues, departments] = await Promise.all([
    fetchQuery(api.issues.list, { limit: 200 }),
    fetchQuery(api.departments.list, {}),
  ]);
  const deptById = new Map(departments.map((d) => [d._id, d.name]));

  let publicIssues: Issue[] = issues
    .filter((issue) => issue.status !== "duplicate")
    .map((issue) =>
      mapConvexIssue(issue, {
        departmentName: issue.departmentId ? deptById.get(issue.departmentId) : null,
      }),
    );

  // Fallback to rich mock data on a fresh, still-empty Convex deployment.
  if (publicIssues.length === 0) {
    publicIssues = MOCK_ISSUES;
  }

  return (
    <PublicShell>
      <div className={styles.head}>
        <h1 className={styles.title}>
          Live issue <span className={styles.accent}>map.</span>
        </h1>
        <p className={styles.subtitle}>
          Every publicly visible civic issue across the city. Locations are generalized to protect
          resident privacy, and every marker has a keyboard-accessible card below.
        </p>
      </div>

      <MapExplorer issues={publicIssues} />
    </PublicShell>
  );
}
