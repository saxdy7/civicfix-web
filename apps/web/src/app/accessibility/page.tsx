import { PublicShell } from "@/components/PublicShell";

import styles from "./page.module.css";

export default function AccessibilityPage() {
  return (
    <PublicShell>
      <h1 className={styles.title}>Accessibility &amp; privacy</h1>

      <section className={styles.section}>
        <h2>Accessibility</h2>
        <p>
          CivicFix targets WCAG 2.2 AA across the public site and staff console: semantic
          landmarks, a keyboard alternative to every map interaction, visible focus states,
          44px touch targets, labeled form fields with clear error text, contrast-checked color
          tokens, live regions for submission and status updates, and support for reduced
          motion.
        </p>
        <p>
          If the map fails to load or you prefer not to use it, every map view falls back to a
          sortable list with neighborhood and location text.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Privacy</h2>
        <ul>
          <li>Public maps generalize sensitive residential coordinates.</li>
          <li>EXIF metadata is removed from photos before any public display.</li>
          <li>Reporter contact details are never shown publicly and are role-restricted internally.</li>
          <li>Every privileged read, export, role change, or workflow override is recorded as an append-only audit event.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>AI use</h2>
        <p>
          AI assists with category, severity, and duplicate suggestions. It never autonomously
          rejects, closes, or assigns an issue — every suggestion is reviewed by staff, and its
          confidence score, model, and prompt version are logged.
        </p>
      </section>
    </PublicShell>
  );
}
