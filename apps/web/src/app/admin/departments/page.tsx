import { Card } from "@civicfix/ui-web";

import { mapDepartmentRow, slaCutoffIso } from "@/lib/admin-mappers";
import { createServerSupabase } from "@/lib/supabase-server";
import { CATEGORY_LABEL } from "@/lib/status";
import type { Department, IssueCategory } from "@/lib/types";

import styles from "../admin.module.css";

interface DepartmentRow {
  id: string;
  name: string;
  categories: IssueCategory[];
  sla_hours: number;
}

async function loadDepartments(): Promise<Department[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data: departmentRows } = await supabase
    .from("departments")
    .select("id, name, categories, sla_hours")
    .order("name", { ascending: true });

  const rows = (departmentRows ?? []) as DepartmentRow[];

  const counts = await Promise.all(
    rows.map(async (dept) => {
      const openBase = supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("department_id", dept.id)
        .not("status", "in", "(resolved,rejected,duplicate)");

      const overdueBase = supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("department_id", dept.id)
        .not("status", "in", "(resolved,rejected,duplicate)")
        .lt("created_at", slaCutoffIso(dept.sla_hours));

      const [openRes, overdueRes] = await Promise.all([openBase, overdueBase]);
      return { open: openRes.count ?? 0, overdue: overdueRes.count ?? 0 };
    }),
  );

  return rows.map((row, i) => mapDepartmentRow(row, counts[i].open, counts[i].overdue));
}

export default async function DepartmentsPage() {
  const departments = await loadDepartments();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Departments &amp; SLA</h1>
        <p className={styles.subtitle}>Coverage and service-level targets by department.</p>
      </div>

      <Card>
        {departments === null ? (
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to see live department data here.
          </p>
        ) : departments.length === 0 ? (
          <p className={styles.emptyState}>No departments configured yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Categories</th>
                  <th>SLA target</th>
                  <th>Open issues</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td>{dept.name}</td>
                    <td>{dept.categories.map((c) => CATEGORY_LABEL[c]).join(", ") || "—"}</td>
                    <td>{dept.slaHours}h</td>
                    <td>{dept.openIssues}</td>
                    <td
                      style={{
                        color: dept.overdueIssues > 0 ? "var(--color-civic-red)" : undefined,
                        fontWeight: dept.overdueIssues > 0 ? 700 : 400,
                      }}
                    >
                      {dept.overdueIssues}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
