import { redirect } from "next/navigation";

import { Badge, Card } from "@civicfix/ui-web";

import { STAFF_ROLES } from "@/lib/admin-mappers";
import { createServerSupabase, getSessionProfile } from "@/lib/supabase-server";
import type { StaffUser } from "@/lib/types";

import styles from "../admin.module.css";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  department_manager: "Department manager",
  field_worker: "Field worker",
  auditor: "Auditor",
};

interface RoleRow {
  user_id: string;
  role: string;
  department_id: string | null;
}

async function loadStaff(): Promise<StaffUser[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role, department_id")
    .in("role", [...STAFF_ROLES]);

  const rows = (roleRows ?? []) as RoleRow[];
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const departmentIds = Array.from(new Set(rows.map((r) => r.department_id).filter((id): id is string => !!id)));

  const [{ data: profiles }, { data: departments }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", userIds),
    departmentIds.length > 0
      ? supabase.from("departments").select("id, name").in("id", departmentIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const departmentById = new Map((departments ?? []).map((d) => [d.id, d.name]));

  // One row per (user, staff role) — a person holding two staff roles appears twice,
  // which is accurate rather than collapsing to a single fabricated "primary" role.
  return rows.map((row) => {
    const profile = profileById.get(row.user_id);
    return {
      id: `${row.user_id}:${row.role}`,
      name: profile?.full_name || "Unnamed",
      email: profile?.email || "—",
      role: (row.role === "administrator" ? "admin" : row.role) as StaffUser["role"],
      department: row.department_id ? departmentById.get(row.department_id) : undefined,
      // The schema has no deactivation flag yet — every granted role is active by definition.
      active: true,
    };
  });
}

export default async function UsersPage() {
  const session = await getSessionProfile();
  if (!session?.isAdmin) redirect("/admin");

  const users = await loadStaff();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>User &amp; role management</h1>
        <p className={styles.subtitle}>Scoped RBAC for staff. Every role change is an append-only audit event.</p>
      </div>

      <Card>
        {users === null ? (
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to see live staff accounts here.
          </p>
        ) : users.length === 0 ? (
          <p className={styles.emptyState}>No staff accounts yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{ROLE_LABEL[user.role] ?? user.role}</td>
                    <td>{user.department ?? "—"}</td>
                    <td>
                      <Badge tone={user.active ? "success" : "warning"}>{user.active ? "Active" : "Inactive"}</Badge>
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
