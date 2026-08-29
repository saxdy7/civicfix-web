"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { Button, Card } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import styles from "./IssueChat.module.css";

/**
 * Convex's useQuery is a live subscription by default — new messages appear
 * for both parties the instant they're written, with no manual realtime
 * channel or polling to wire up.
 */
export function IssueChat({ issueId, senderRole }: { issueId: Id<"issues">; senderRole: "resident" | "staff" }) {
  const viewer = useQuery(api.users.viewer, {});
  const messages = useQuery(api.issueMessages.listForIssue, { issueId });
  const send = useMutation(api.issueMessages.send);
  const markRead = useMutation(api.issueMessages.markRead);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages && messages.length > 0) void markRead({ issueId });
  }, [messages, issueId, markRead]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await send({ issueId, body: draft.trim(), senderRole });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>Conversation</h2>
      <div className={styles.list} ref={listRef}>
        {messages === undefined ? (
          <p className={styles.emptyHint}>Loading…</p>
        ) : messages.length === 0 ? (
          <p className={styles.emptyHint}>No messages yet — say hello.</p>
        ) : (
          messages.map((m) => (
            <div key={m._id} className={m.senderId === viewer?._id ? styles.bubbleOwn : styles.bubbleOther}>
              <p className={styles.bubbleRole}>{m.senderRole === "staff" ? "City staff" : "Resident"}</p>
              <p className={styles.bubbleBody}>{m.body}</p>
              <p className={styles.bubbleTime}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p role="alert" className={styles.errorText}>
          {error}
        </p>
      ) : null}

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={sending || !draft.trim()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </Card>
  );
}
