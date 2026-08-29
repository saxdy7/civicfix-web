"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { Button, Card } from "@civicfix/ui-web";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import styles from "./IssueChat.module.css";

interface Message {
  id: string;
  senderId: string;
  senderRole: "resident" | "staff";
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface RawMessageRow {
  id: string;
  sender_id: string;
  sender_role: "resident" | "staff";
  body: string;
  created_at: string;
  read_at: string | null;
}

function mapRow(row: RawMessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export function IssueChat({
  issueId,
  currentUserId,
  senderRole,
}: {
  issueId: string;
  currentUserId: string;
  senderRole: "resident" | "staff";
}) {
  const [messages, setMessages] = useState<Message[] | null>(isSupabaseConfigured ? null : []);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;

    let channel: RealtimeChannel | null = null;
    let active = true;

    async function load() {
      if (!supabase) return;
      const { data } = await supabase
        .from("issue_messages")
        .select("id, sender_id, sender_role, body, created_at, read_at")
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });

      if (!active) return;
      setMessages(((data as RawMessageRow[] | null) ?? []).map(mapRow));
      await supabase.rpc("mark_issue_messages_read", { p_issue_id: issueId });

      channel = supabase
        .channel(`issue-messages-${issueId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "issue_messages", filter: `issue_id=eq.${issueId}` },
          (payload) => {
            const row = payload.new as RawMessageRow;
            setMessages((prev) => (prev ? [...prev, mapRow(row)] : [mapRow(row)]));
            if (row.sender_id !== currentUserId) {
              supabase?.rpc("mark_issue_messages_read", { p_issue_id: issueId });
            }
          },
        )
        .subscribe();
    }

    load();

    return () => {
      active = false;
      if (channel) supabase?.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !supabase) return;
    setSending(true);
    setError(null);
    const { error: insertError } = await supabase.from("issue_messages").insert({
      issue_id: issueId,
      sender_id: currentUserId,
      sender_role: senderRole,
      body: draft.trim(),
    });
    setSending(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft("");
  };

  if (!isSupabaseConfigured) {
    return (
      <Card>
        <p className={styles.emptyHint}>Chat isn&apos;t available in preview mode — Supabase isn&apos;t configured.</p>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>Conversation</h2>
      <div className={styles.list} ref={listRef}>
        {messages === null ? (
          <p className={styles.emptyHint}>Loading…</p>
        ) : messages.length === 0 ? (
          <p className={styles.emptyHint}>No messages yet — say hello.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.senderId === currentUserId ? styles.bubbleOwn : styles.bubbleOther}>
              <p className={styles.bubbleRole}>{m.senderRole === "staff" ? "City staff" : "Resident"}</p>
              <p className={styles.bubbleBody}>{m.body}</p>
              <p className={styles.bubbleTime}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
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
