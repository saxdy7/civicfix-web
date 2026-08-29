"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Badge, Button } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import styles from "../admin.module.css";

const ROLE_LABEL: Record<string, string> = {
  field_worker: "Field worker",
  department_manager: "Department manager",
};

export function AccessRequestTable() {
  const requests = useQuery(api.staffAccessRequests.list, {});
  const departments = useQuery(api.departments.list, {});
  const deptById = new Map((departments ?? []).map((d) => [d._id, d.name]));

  const approve = useMutation(api.staffAccessRequests.approve);
  const reject = useMutation(api.staffAccessRequests.reject);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function decide(id: Id<"staffAccessRequests">, action: "approve" | "reject") {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await (action === "approve" ? approve : reject)({ requestId: id });
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Could not record this decision." }));
    } finally {
      setBusyId(null);
    }
  }

  if (requests === undefined) {
    return <p className={styles.emptyState}>Loading…</p>;
  }
  if (requests.length === 0) {
    return <p className={styles.emptyState}>No access requests yet.</p>;
  }

  const sorted = [...requests].sort((a, b) => b.createdAt - a.createdAt);

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
          {sorted.map((req) => (
            <tr key={req._id}>
              <td>{req.fullName}</td>
              <td>{req.workEmail}</td>
              <td>{req.employeeId}</td>
              <td>{req.departmentId ? (deptById.get(req.departmentId) ?? "—") : "—"}</td>
              <td>{ROLE_LABEL[req.requestedRole] ?? req.requestedRole}</td>
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
                      <Button onClick={() => decide(req._id, "approve")} disabled={busyId === req._id}>
                        {busyId === req._id ? "Working…" : "Approve"}
                      </Button>
                      <Button variant="secondary" onClick={() => decide(req._id, "reject")} disabled={busyId === req._id}>
                        Reject
                      </Button>
                    </div>
                    {errors[req._id] ? (
                      <p role="alert" className={styles.errorText} style={{ marginTop: "var(--space-2)" }}>
                        {errors[req._id]}
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
