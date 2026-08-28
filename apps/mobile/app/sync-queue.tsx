import { Text, View, StyleSheet } from "react-native";

import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { color, fontSize, spacing } from "../lib/theme";

const QUEUE = [
  { id: "q1", label: "Before photo — CF-10234", queuedAt: "2026-08-28T08:00:00Z" },
  { id: "q2", label: "Draft report — Streetlight, Oak Hill", queuedAt: "2026-08-28T08:05:00Z" },
];

export default function SyncQueue() {
  if (QUEUE.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState title="All synced" description="Nothing is waiting to upload." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.hint}>
        These items were captured offline and will upload automatically once you're back online.
      </Text>
      {QUEUE.map((item) => (
        <Card key={item.id} style={{ marginBottom: spacing[3] }}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.badge}>Unsynced</Text>
          </View>
          <Text style={styles.date}>Queued {new Date(item.queuedAt).toLocaleString()}</Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: color.foreground,
  },
  badge: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: color.civicAmber,
  },
  date: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
  },
});
