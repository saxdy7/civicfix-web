import { PublicShell } from "@/components/PublicShell";
import { mapIssueRow, type RawIssueRow } from "@/lib/issue-mappers";
import { createServerSupabase } from "@/lib/supabase-server";
import { MOCK_ISSUES } from "@/lib/mock-data";
import type { Issue } from "@/lib/types";

import { MapExplorer } from "./MapExplorer";
import styles from "./page.module.css";

export default async function PublicMapPage() {
  const supabase = await createServerSupabase();
  let publicIssues: Issue[] = [];

  if (supabase) {
    // RLS (`issues_select_public`) already restricts an anonymous/citizen
    // session to public, non-deleted rows (plus their own) — the filters
    // below just keep the query intent explicit and cap the payload size.
    const { data } = await supabase
      .from("issues")
      .select("*, departments(name)")
      .eq("is_public", true)
      .is("deleted_at", null)
      .neq("status", "duplicate")
      .order("created_at", { ascending: false })
      .limit(200);

    publicIssues = ((data as RawIssueRow[] | null) ?? []).map((row) => mapIssueRow(row));
  }

  // Fallback to rich mock data if table is empty or Supabase is not configured
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
