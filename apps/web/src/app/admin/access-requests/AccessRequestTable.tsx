"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button } from "@civicfix/ui-web";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import styles from "../admin.module.css";

export interface AccessRequestRow {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewNote: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  field_worker: "Field worker",
  department_manager: "Department manager",
};

export function AccessRequestTable({ requests }: { requests: AccessRequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function decide(id: string, action: "approve" | "reject") {
    if (!supabase) return;
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const { error } = await supabase.rpc(
        action === "approve" ? "approve_staff_access_request" : "reject_staff_access_request",
        { request_id: id },
      );
      if (error) throw error;
      router.refresh();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Could not record this decision.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Work email</th>
            <th>Employee ID</th>
            <th>Department</th>
            <th>Requested role</th>
            <th>Status</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>{req.name}</td>
              <td>{req.email}</td>
              <td>{req.employeeId}</td>
              <td>{req.department}</td>
              <td>{ROLE_LABEL[req.role] ?? req.role}</td>
              <td>
                {req.status === "approved" ? (
                  <Badge tone="success">Approved</Badge>
                ) : req.status === "rejected" ? (
                  <Badge tone="danger">Rejected</Badge>
                ) : (
                  <Badge tone="warning">Pending review</Badge>
                )}
              </td>
              <td>
                {req.status === "pending" ? (
                  <div>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <Button
                        onClick={() => decide(req.id, "approve")}
                        disabled={busyId === req.id || !isSupabaseConfigured}
                      >
                        {busyId === req.id ? "Working…" : "Approve"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => decide(req.id, "reject")}
                        disabled={busyId === req.id || !isSupabaseConfigured}
                      >
                        Reject
                      </Button>
                    </div>
                    {errors[req.id] ? (
                      <p role="alert" className={styles.errorText} style={{ marginTop: "var(--space-2)" }}>
                        {errors[req.id]}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                    {req.reviewNote || "No note"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
