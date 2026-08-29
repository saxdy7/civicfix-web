import { redirect } from "next/navigation";

import { Card } from "@civicfix/ui-web";

import { getSessionProfile } from "@/lib/session";

import { AccessRequestTable } from "./AccessRequestTable";
import styles from "../admin.module.css";

export default async function AccessRequestsPage() {
  const session = await getSessionProfile();
  if (!session?.isAdmin) redirect("/admin");

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
        <AccessRequestTable />
      </Card>
    </div>
  );
}
