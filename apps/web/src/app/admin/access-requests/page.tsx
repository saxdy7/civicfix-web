import { Card } from "@civicfix/ui-web";

import { createServerSupabase } from "@/lib/supabase-server";

import { AccessRequestTable, type AccessRequestRow } from "./AccessRequestTable";
import styles from "../admin.module.css";

interface RawRequestRow {
  id: string;
  full_name: string;
  work_email: string;
  employee_id: string;
  requested_role: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_note: string | null;
  departments: { name: string } | null;
}

async function loadRequests(): Promise<AccessRequestRow[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("staff_access_requests")
    .select(
      "id, full_name, work_email, employee_id, requested_role, status, created_at, review_note, departments(name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as RawRequestRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.work_email,
    employeeId: row.employee_id,
    department: row.departments?.name ?? "—",
    role: row.requested_role,
    status: row.status,
    requestedAt: row.created_at,
    reviewNote: row.review_note,
  }));
}

export default async function AccessRequestsPage() {
  const requests = await loadRequests();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Staff access requests</h1>
        <p className={styles.subtitle}>
          Verify each employee ID against the department roster before approving. Approving grants
          a privileged role and is written to the audit log.
        </p>
      </div>

      <Card>
        {requests === null ? (
          <p className={styles.emptyState}>
            Supabase is not configured — connect it to review live access requests.
          </p>
        ) : requests.length === 0 ? (
          <p className={styles.emptyState}>No access requests yet.</p>
        ) : (
          <AccessRequestTable requests={requests} />
        )}
      </Card>
    </div>
  );
}
