"use client";

import { useState } from "react";
import { CivicBot } from "./CivicBot";
import styles from "./CivicBotWidget.module.css";

export function CivicBotWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside aria-label="CivicFix Assistant" className={styles.widgetContainer}>
      {isOpen && (
        <div className={styles.chatWindow}>
          <CivicBot onClose={() => setIsOpen(false)} />
        </div>
      )}

      <button
        type="button"
        className={styles.floatingButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close CivicFix Assistant" : "Open CivicFix AI Assistant"}
      >
        {isOpen ? "✕" : "🤖"}
        {!isOpen && <span className={styles.badge}>AI</span>}
      </button>
    </aside>
  );
}
