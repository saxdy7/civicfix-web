import Link from "next/link";

import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";

import styles from "../../resident.module.css";

export default async function ReportSubmittedPage({
  searchParams,
}: PageProps<"/app/report/submitted">) {
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const trackingId = get("trackingId") ?? "CF-00000";
  const category = get("category");
  const severity = get("severity");
  const lat = get("lat");
  const lng = get("lng");

  return (
    <div className={styles.receipt}>
      <span className={styles.receiptCheck} aria-hidden="true">
        ✓
      </span>

      <div>
        <h1 className={styles.title} style={{ marginBottom: "var(--space-2)" }}>
          Report received
        </h1>
        <p className={styles.subtitle}>
          Keep this tracking ID. You can quote it to any city department, and you will be
          notified as your report moves through triage, assignment and verification.
        </p>
      </div>

      <div className={styles.receiptCard}>
        <p className={styles.receiptLabel}>Tracking ID</p>
        <p className={styles.receiptId}>{trackingId}</p>

        <div className={styles.receiptRows}>
          <div className={styles.receiptRow}>
            <span className={styles.receiptRowLabel}>Category</span>
            <span>{category ? (CATEGORY_LABEL[category] ?? category) : "—"}</span>
          </div>
          <div className={styles.receiptRow}>
            <span className={styles.receiptRowLabel}>Reported severity</span>
            <span>{severity ? (SEVERITY_LABEL[severity] ?? severity) : "—"}</span>
          </div>
          <div className={styles.receiptRow}>
            <span className={styles.receiptRowLabel}>Location</span>
            <span>{lat && lng ? `${lat}, ${lng}` : "—"}</span>
          </div>
          <div className={styles.receiptRow}>
            <span className={styles.receiptRowLabel}>Submitted</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
          <div className={styles.receiptRow}>
            <span className={styles.receiptRowLabel}>Current status</span>
            <span>Submitted and awaiting review</span>
          </div>
        </div>
      </div>

      <p className={styles.hint}>
        <strong>What happens next:</strong> a staff member reviews your report — assisted, never
        replaced, by AI category and duplicate suggestions — then routes it to the responsible
        department with an SLA clock attached.
      </p>

      <div className={styles.actions} style={{ justifyContent: "center" }}>
        <Link
          href="/app/reports"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 44,
            padding: "0 var(--space-5)",
            borderRadius: "var(--radius-pill)",
            background: "var(--color-inverse-background)",
            color: "var(--color-inverse-foreground)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "var(--font-size-sm)",
          }}
        >
          View my reports
        </Link>
        <Link
          href="/app/report"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 44,
            padding: "0 var(--space-5)",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "var(--font-size-sm)",
          }}
        >
          Report another issue
        </Link>
      </div>
    </div>
  );
}
