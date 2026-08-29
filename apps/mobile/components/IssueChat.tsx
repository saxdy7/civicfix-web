import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";
import { Button } from "./Button";
import { Card } from "./Card";

interface Message {
  id: string;
  senderId: string;
  senderRole: "resident" | "staff";
  body: string;
  createdAt: string;
}

interface RawMessageRow {
  id: string;
  sender_id: string;
  sender_role: "resident" | "staff";
  body: string;
  created_at: string;
}

function mapRow(row: RawMessageRow): Message {
  return { id: row.id, senderId: row.sender_id, senderRole: row.sender_role, body: row.body, createdAt: row.created_at };
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
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!supabase) return;

    let channel: RealtimeChannel | null = null;
    let active = true;

    async function load() {
      if (!supabase) return;
      const { data } = await supabase
        .from("issue_messages")
        .select("id, sender_id, sender_role, body, created_at")
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
        <Text style={styles.emptyHint}>Chat isn&apos;t available in demo mode.</Text>
      </Card>
    );
  }

  return (
    <Card style={{ gap: spacing[3] }}>
      <Text style={styles.title}>Conversation</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages === null ? (
          <Text style={styles.emptyHint}>Loading…</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.emptyHint}>No messages yet — say hello.</Text>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.senderId === currentUserId ? styles.bubbleOwn : styles.bubbleOther]}>
              <Text style={styles.bubbleRole}>{m.senderRole === "staff" ? "City staff" : "Resident"}</Text>
              <Text style={[styles.bubbleBody, m.senderId === currentUserId && styles.bubbleBodyOwn]}>{m.body}</Text>
              <Text style={styles.bubbleTime}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a message…"
            placeholderTextColor={color.dimForeground}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Button label={sending ? "…" : "Send"} onPress={handleSend} disabled={sending || !draft.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  list: {
    maxHeight: 260,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    textAlign: "center",
    paddingVertical: spacing[4],
  },
  bubble: {
    maxWidth: "82%",
    padding: spacing[3],
    borderRadius: radius.control,
    marginBottom: spacing[2],
  },
  bubbleOwn: {
    alignSelf: "flex-end",
    backgroundColor: color.inverseBackground,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
  },
  bubbleRole: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
    color: color.mutedForeground,
  },
  bubbleBody: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.foreground,
    marginTop: 2,
  },
  bubbleBodyOwn: {
    color: color.inverseForeground,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: fontFamily.regular,
    color: color.dimForeground,
    marginTop: 2,
  },
  composer: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    padding: spacing[3],
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    color: color.foreground,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
});
