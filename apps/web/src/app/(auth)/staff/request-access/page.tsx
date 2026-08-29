import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";

import { getPlatformStats } from "@/lib/platform-stats";
import { getSessionProfile } from "@/lib/session";

import { api } from "@convex/_generated/api";

import { AuthShowcase } from "../../AuthShowcase";
import { StaffRequestForm } from "./StaffRequestForm";
import styles from "../../auth.module.css";

export const metadata: Metadata = {
  title: "Request staff access · CivicFix",
};

export default async function StaffRequestAccessPage() {
  const [stats, session, departments] = await Promise.all([
    getPlatformStats(),
    getSessionProfile(),
    fetchQuery(api.departments.list, {}),
  ]);

  return (
    <div className={styles.shell}>
      <StaffRequestForm
        session={session ? { userId: session.userId, email: session.email } : null}
        departments={departments.map((d) => ({ id: d._id, name: d.name }))}
      />
      <AuthShowcase
        title="Staff access is granted, never claimed."
        body="Privileged roles cannot be self-assigned. Your request is verified by an existing administrator before you can view reporter data or move an issue through the workflow."
        points={[
          "Municipal email and employee ID required",
          "Reviewed by an administrator, usually within one business day",
          "Every approval and role change is written to the audit log",
        ]}
        stats={stats}
      />
    </div>
  );
}
