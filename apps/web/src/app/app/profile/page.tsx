import { Badge, Card } from "@civicfix/ui-web";

import styles from "../resident.module.css";

export default function ResidentProfilePage() {
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
          <span>Amara Okonkwo</span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Email</span>
          <span>amara@example.com</span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Role</span>
          <span>
            <Badge tone="neutral">Resident</Badge>
          </span>
        </div>
        <div className={styles.sideStat}>
          <span className={styles.sideStatLabel}>Member since</span>
          <span>August 2026</span>
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
