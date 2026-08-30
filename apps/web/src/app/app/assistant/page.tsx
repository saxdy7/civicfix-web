import { CivicBot } from "@/components/chatbot";
import styles from "../resident.module.css";

export default function AssistantPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)", minHeight: "650px" }}>
      <div className={styles.pageHeader} style={{ marginBottom: "16px" }}>
        <h1 className={styles.title}>CivicFix AI Assistant</h1>
        <p className={styles.subtitle}>
          Your automated assistant for instant civic issue reporting, status queries, and municipal
          guidance. Speak or type in plain language to get started.
        </p>
      </div>

      <div style={{ flex: 1, minHeight: "540px", width: "100%", maxWidth: "1000px" }}>
        <CivicBot isFullPage />
      </div>
    </div>
  );
}
