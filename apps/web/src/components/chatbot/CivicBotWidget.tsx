"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconAiAssistant } from "@/components/Icons";
import { CivicBot } from "./CivicBot";
import styles from "./CivicBotWidget.module.css";

export function CivicBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Hide widget floating button when user is on the dedicated AI Assistant page
  if (pathname === "/app/assistant") {
    return null;
  }

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
        {isOpen ? "✕" : <IconAiAssistant size={24} />}
        {!isOpen && <span className={styles.badge}>AI</span>}
      </button>
    </aside>
  );
}
