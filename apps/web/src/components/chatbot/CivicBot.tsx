"use client";

import { useEffect, useRef, useState } from "react";
import { useCivicBot } from "./useCivicBot";
import { FormattedMessage } from "./FormattedMessage";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/status";
import {
  IconAiAssistant,
  IconCamera,
  IconCheck,
  IconClose,
  IconEdit,
  IconMapPin,
  IconMic,
  IconSend,
} from "@/components/Icons";
import styles from "./CivicBot.module.css";

interface CivicBotProps {
  className?: string;
  onClose?: () => void;
  isFullPage?: boolean;
}

export function CivicBot({ className, onClose, isFullPage }: CivicBotProps) {
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

  const [isListening, setIsListening] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

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

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation is not supported by your browser");
      return;
    }
    setGeoStatus("Locating...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const locMsg = `[Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}] Report issue near my GPS position`;
        setInput((prev) => (prev ? `${prev} ${locMsg}` : locMsg));
        setGeoStatus("GPS Position Attached");
        setTimeout(() => setGeoStatus(null), 3000);
      },
      (err) => {
        console.error(err);
        setGeoStatus("Could not fetch GPS position");
        setTimeout(() => setGeoStatus(null), 3000);
      },
    );
  };

  const handleVoiceListen = () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please type your issue.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className={`${styles.container} ${isFullPage ? styles.fullPageContainer : ""} ${className ?? ""}`}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.botAvatar}>
            <IconAiAssistant size={20} />
          </div>
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
            <IconClose size={18} />
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
              <FormattedMessage text={m.text} isUser={m.sender === "user"} />

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
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      {act.actionId === "confirm_report" ? <IconCheck size={14} /> : act.actionId === "modify_report" ? <IconEdit size={14} /> : null}
                      <span>{act.label}</span>
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
            <IconCamera size={14} />
            <span>Photo attached</span>
            <button
              type="button"
              onClick={() => setAttachedPhoto(null)}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
              }}
            >
              <IconClose size={14} />
            </button>
          </div>
        )}

        {geoStatus && (
          <div className={styles.photoPreview} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
            <IconMapPin size={14} />
            <span>{geoStatus}</span>
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
            <IconCamera size={18} />
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={handleGetLocation}
            title="Attach GPS Location"
            aria-label="Attach GPS Location"
          >
            <IconMapPin size={18} />
          </button>

          <button
            type="button"
            className={`${styles.iconButton} ${isListening ? styles.listeningButton : ""}`}
            onClick={handleVoiceListen}
            title={isListening ? "Listening... click to stop" : "Speak to report issue"}
            aria-label="Voice input"
            style={isListening ? { background: "#ef4444", color: "#fff", borderColor: "#ef4444" } : undefined}
          >
            <IconMic size={18} />
          </button>

          <input
            type="text"
            className={styles.inputField}
            placeholder={isListening ? "Listening to your voice..." : "Type or speak your civic issue or tracking ID…"}
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
            <IconSend size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
