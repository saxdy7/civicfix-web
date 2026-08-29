"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";

import { Badge, Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";

import styles from "../admin.module.css";

const ROLE_LABEL: Record<string, string> = {
  administrator: "Administrator",
  department_manager: "Department manager",
  field_worker: "Field worker",
  auditor: "Auditor",
};

export default function UsersPage() {
  const router = useRouter();
  const viewer = useQuery(api.users.viewer, {});
  const staff = useQuery(api.users.listStaff, {});
  const notAdmin = viewer !== undefined && !viewer?.roles.includes("administrator");

  useEffect(() => {
    if (notAdmin) router.replace("/admin");
  }, [notAdmin, router]);

  if (notAdmin) return null;

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>User &amp; role management</h1>
        <p className={styles.subtitle}>Scoped RBAC for staff. Every role change is an append-only audit event.</p>
      </div>

      <Card>
        {staff === undefined ? (
          <p className={styles.emptyState}>Loading…</p>
        ) : staff.length === 0 ? (
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
                {staff.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{ROLE_LABEL[user.role] ?? user.role}</td>
                    <td>{user.department ?? "—"}</td>
                    <td>
                      <Badge tone="success">Active</Badge>
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
