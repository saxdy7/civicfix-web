import { CivicBot } from "@/components/chatbot";
import styles from "../resident.module.css";

export default function AssistantPage() {
  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>CivicFix AI Assistant</h1>
        <p className={styles.subtitle}>
          Your automated assistant for instant civic issue reporting, status queries, and municipal
          guidance. Speak or type in plain language to get started.
        </p>
      </div>

      <div style={{ height: "620px", maxWidth: "800px" }}>
        <CivicBot />
      </div>
    </div>
  );
}
