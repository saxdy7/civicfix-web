import { Badge, Card } from "@civicfix/ui-web";

import { getSessionProfile } from "@/lib/supabase-server";

import styles from "../resident.module.css";

const ROLE_LABEL: Record<string, string> = {
  administrator: "Administrator",
  department_manager: "Department manager",
  field_worker: "Field worker",
  auditor: "Auditor",
};

function primaryRoleLabel(roles: string[]): string {
  const staffRole = roles.find((r) => r in ROLE_LABEL);
  return staffRole ? ROLE_LABEL[staffRole] : "Resident";
}

export default async function ResidentProfilePage() {
  const session = await getSessionProfile();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Profile &amp; privacy</h1>
        <p className={styles.subtitle}>
          What CivicFix knows about you, who can see it, and how to change it.
        </p>
      </div>

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Name</span>
          <span>{session?.name ?? "Resident"}</span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Email</span>
          <span>{session?.email ?? "—"}</span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Role</span>
          <span>
            <Badge tone="neutral">{session ? primaryRoleLabel(session.roles) : "Resident"}</Badge>
          </span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Member since</span>
          <span>
            {session
              ? new Date(session.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </span>
        </div>
      </Card>

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 className={styles.sectionTitle}>Who can see your reports</h2>
        <p className={styles.hint} style={{ marginBottom: "var(--space-3)" }}>
          Your name and email are <strong>never</strong> shown publicly. On the public map your
          reports appear anonymously, with the location generalised to protect your address.
        </p>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Public map shows</span>
          <span>Category, generalised location, status</span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Authorised staff can see</span>
          <span>Exact coordinates, your photo, your description</span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Every staff access is</span>
          <span>Written to an append-only audit log</span>
        </div>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Notification preferences</h2>
        <p className={styles.hint}>
          You are currently notified by email at every status change. Push notifications arrive
          through the CivicFix mobile app once you sign in there.
        </p>
      </Card>
    </div>
  );
}
