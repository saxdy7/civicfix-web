import { ReportComposer } from "./ReportComposer";
import styles from "../resident.module.css";

export default function ReportIssuePage() {
  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Report an issue</h1>
        <p className={styles.subtitle}>
          Five short steps. You will get a tracking ID immediately and a notification at every
          stage after that.
        </p>
      </div>

      <ReportComposer />
    </div>
  );
}
