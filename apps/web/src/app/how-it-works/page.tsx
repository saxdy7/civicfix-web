import { Card, Eyebrow } from "@civicfix/ui-web";

import { PublicShell } from "@/components/PublicShell";
import { STATUS_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import type { IssueStatus } from "@/lib/types";

import styles from "./page.module.css";

const LIFECYCLE: IssueStatus[] = [
  "reported",
  "triaged",
  "assigned",
  "in_progress",
  "pending_verification",
  "resolved",
];

const ROLES = [
  {
    title: "Residents",
    body: "Report an issue with a photo and a pin, get a tracking ID, and receive a notification at every stage. Confirm a neighbour's existing report instead of filing a duplicate.",
  },
  {
    title: "Department managers",
    body: "Work a triaged queue with AI-suggested category and severity, review duplicate candidates, approve routing, and watch the SLA clock.",
  },
  {
    title: "Field workers",
    body: "Accept assignments, navigate to the location, and capture before/after evidence — which enters verification before anything is called resolved.",
  },
  {
    title: "Auditors",
    body: "A daily 02:00 UTC job checks integrity, SLA breaches, missing evidence, failed jobs, and privileged access, then files accountable findings.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <div className={styles.head}>
        <Eyebrow centered>How it works</Eyebrow>
        <h1 className={styles.title}>
          A report is not the end. It&apos;s <span className={styles.accent}>the beginning.</span>
        </h1>
        <p className={styles.subtitle}>
          Every CivicFix issue moves through a fixed, auditable lifecycle. Residents see the
          plain-language stage; staff see the operational detail.
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The lifecycle</h2>
        <div className={styles.lifecycle}>
          {LIFECYCLE.map((status, index) => (
            <Card key={status} className={styles.lifecycleCard}>
              <span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span>
              <h3 className={styles.cardTitle}>{STATUS_SHORT_LABEL[status]}</h3>
              <p className={styles.cardBody}>{STATUS_LABEL[status]}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Who does what</h2>
        <div className={styles.roles}>
          {ROLES.map((role) => (
            <Card key={role.title} tone="muted">
              <h3 className={styles.cardTitle}>{role.title}</h3>
              <p className={styles.cardBody}>{role.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <Card tone="inverse" className={styles.aiNote}>
          <h2 className={styles.cardTitleInverse}>Where AI fits — and where it doesn&apos;t</h2>
          <p className={styles.cardBodyInverse}>
            AI suggests a category, a severity, a short summary, and possible duplicates. Every
            suggestion is labelled AI-assisted, carries a confidence score, and is reviewed by a
            person. AI can never reject, close, or assign an issue on its own — low confidence or
            an unavailable provider routes straight to manual triage.
          </p>
        </Card>
      </section>
    </PublicShell>
  );
}
