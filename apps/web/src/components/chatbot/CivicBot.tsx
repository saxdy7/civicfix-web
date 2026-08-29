"use client";

import { useEffect, useRef } from "react";
import { useCivicBot } from "./useCivicBot";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/status";
import styles from "./CivicBot.module.css";

interface CivicBotProps {
  className?: string;
  onClose?: () => void;
}

export function CivicBot({ className, onClose }: CivicBotProps) {
  const {
    messages,
    input,
    setInput,
    attachedPhoto,
    setAttachedPhoto,
    isTyping,
    sendMessage,
    handleAction,
  } = useCivicBot();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() && !attachedPhoto) return;
    sendMessage(input, attachedPhoto || undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.botAvatar}>🤖</div>
          <div>
            <h3 className={styles.botTitle}>
              CivicFix Assistant <span className={styles.onlineBadge} />
            </h3>
            <p className={styles.botSubtitle}>Automated Reporting & Civic Resolution</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label="Close Assistant"
          >
            ✕
          </button>
        )}
      </div>

      <div className={styles.messageList} ref={listRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.messageBubble} ${
              m.sender === "bot" ? styles.botBubble : styles.userBubble
            }`}
          >
            <div className={styles.bubbleContent}>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>

              {/* Draft Report Card */}
              {m.type === "report_draft" && m.data?.draft && (
                <div className={styles.cardContainer}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>📋 Proposed Ticket</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "var(--color-primary, #0284c7)",
                        color: "#fff",
                      }}
                    >
                      {CATEGORY_LABEL[m.data.draft.category]}
                    </span>
                  </div>
                  <div className={styles.cardField}>
                    <strong>Priority:</strong> {m.data.draft.severity.toUpperCase()}
                  </div>
                  <div className={styles.cardField}>
                    <strong>Detected Area:</strong> {m.data.draft.neighborhood}
                  </div>
                  <div className={styles.cardField}>
                    <strong>Description:</strong> {m.data.draft.description}
                  </div>
                  {m.data.duplicates && m.data.duplicates.length > 0 && (
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: "4px",
                        background: "#fef3c7",
                        color: "#92400e",
                        fontSize: "11px",
                        marginTop: "4px",
                      }}
                    >
                      ⚠️ <strong>Nearby Issue Found:</strong> {m.data.duplicates[0].trackingId} (
                      {m.data.duplicates[0].distanceMeters}m away). Submitting will merge signals.
                    </div>
                  )}
                </div>
              )}

              {/* Status Query Card */}
              {m.type === "status_card" && m.data?.statusResult && (
                <div className={styles.cardContainer}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      {m.data.statusResult.trackingId}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "#10b981",
                        color: "#fff",
                      }}
                    >
                      {STATUS_LABEL[m.data.statusResult.status]}
                    </span>
                  </div>
                  <div className={styles.cardField}>
                    <strong>Department:</strong>{" "}
                    {m.data.statusResult.department || "Municipal Operations"}
                  </div>
                  <div className={styles.cardField}>
                    <strong>Neighborhood:</strong> {m.data.statusResult.neighborhood}
                  </div>
                  <div className={styles.cardField}>
                    <strong>Last Update:</strong>{" "}
                    {new Date(m.data.statusResult.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* Actions & Chips */}
              {m.actions && m.actions.length > 0 && (
                <div className={styles.actionsRow}>
                  {m.actions.map((act, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`${styles.actionButton} ${
                        act.variant === "primary" ? styles.actionPrimary : ""
                      }`}
                      onClick={() => handleAction(act)}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className={styles.bubbleTime}>
              {new Date(m.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}

        {isTyping && (
          <div className={`${styles.messageBubble} ${styles.botBubble}`}>
            <div className={styles.typingIndicator}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {attachedPhoto && (
          <div className={styles.photoPreview}>
            <span>📷 Photo attached</span>
            <button
              type="button"
              onClick={() => setAttachedPhoto(null)}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div className={styles.inputRow}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => fileInputRef.current?.click()}
            title="Attach photo"
            aria-label="Attach photo"
          >
            📷
          </button>
          <input
            type="text"
            className={styles.inputField}
            placeholder="Type your civic issue or tracking ID…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            className={`${styles.iconButton} ${styles.sendButton}`}
            onClick={handleSend}
            disabled={!input.trim() && !attachedPhoto}
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
