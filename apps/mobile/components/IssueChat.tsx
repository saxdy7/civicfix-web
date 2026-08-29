import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import { useMutation, useQuery } from "convex/react";

import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";
import { Button } from "./Button";
import { Card } from "./Card";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Only ever rendered from a screen gated on a signed-in `user` (see
 * reports/[id].tsx, assignments/[id]/index.tsx) — which only happens when
 * the real Clerk+Convex backend path is active, so the ConvexProvider these
 * hooks need is always present here.
 */
export function IssueChat({
  issueId,
  currentUserId,
  senderRole,
}: {
  issueId: string;
  currentUserId: string;
  senderRole: "resident" | "staff";
}) {
  const messages = useQuery(api.issueMessages.listForIssue, { issueId: issueId as Id<"issues"> });
  const send = useMutation(api.issueMessages.send);
  const markRead = useMutation(api.issueMessages.markRead);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages && messages.length > 0) void markRead({ issueId: issueId as Id<"issues"> });
  }, [messages, issueId, markRead]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await send({ issueId: issueId as Id<"issues">, body: draft.trim(), senderRole });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={{ gap: spacing[3] }}>
      <Text style={styles.title}>Conversation</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages === undefined ? (
          <Text style={styles.emptyHint}>Loading…</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.emptyHint}>No messages yet — say hello.</Text>
        ) : (
          messages.map((m) => (
            <View key={m._id} style={[styles.bubble, m.senderId === currentUserId ? styles.bubbleOwn : styles.bubbleOther]}>
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
