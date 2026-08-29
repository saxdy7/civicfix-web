import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
import { useAuth } from "../../lib/auth-context";
import { fetchMyAssignments } from "../../lib/repositories/assignments";
import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "../../lib/status";
import { color, fontFamily, fontSize, radius, spacing } from "../../lib/theme";
import type { Assignment } from "../../lib/types";

function dueMeta(dueAt: string | null): { label: string; tone: string } {
  if (!dueAt) return { label: "No due date set", tone: color.mutedForeground };
  const diffHours = (new Date(dueAt).getTime() - Date.now()) / 3_600_000;
  if (diffHours < 0) return { label: `Overdue · was due ${new Date(dueAt).toLocaleDateString()}`, tone: color.civicRed };
  if (diffHours < 24) return { label: "Due today", tone: color.civicAmber };
  if (diffHours < 72) return { label: `Due ${new Date(dueAt).toLocaleDateString(undefined, { weekday: "short" })}`, tone: color.civicAmber };
  return { label: `Due ${new Date(dueAt).toLocaleDateString()}`, tone: color.mutedForeground };
}

export default function Assignments() {
  const router = useRouter();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setAssignments(await fetchMyAssignments(user.id));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = assignments.filter((a) => a.status !== "resolved");
  const done = assignments.filter((a) => a.status === "resolved");

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.foreground} />}>
      <Text style={styles.sectionTitle}>My assignments</Text>

      {loading ? (
        <ActivityIndicator color={color.civicBlue} />
      ) : assignments.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="No assignments yet" description="Work routed to you will appear here." />
      ) : (
        <>
          {open.map((assignment) => {
            const due = dueMeta(assignment.dueAt);
            return (
              <Card key={assignment.id} style={{ marginBottom: spacing[3] }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.title}>{CATEGORY_LABEL[assignment.category]}</Text>
                  <View style={[styles.statusChip, { backgroundColor: `${color.civicBlue}1a` }]}>
                    <Text style={[styles.statusChipText, { color: color.civicBlue }]}>
                      {STATUS_SHORT_LABEL[assignment.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.summary} numberOfLines={2}>{assignment.issueSummary}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color={color.mutedForeground} />
                  <Text style={styles.meta}>{assignment.neighborhood}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={14} color={due.tone} />
                  <Text style={[styles.meta, { color: due.tone }]}>{due.label}</Text>
                </View>
                <Button
                  label="Open assignment"
                  onPress={() => router.push({ pathname: "/assignments/[id]", params: { id: assignment.id } })}
                />
              </Card>
            );
          })}

          {done.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing[2] }]}>Completed</Text>
              {done.map((assignment) => (
                <Card key={assignment.id} tone="muted" style={{ marginBottom: spacing[3], opacity: 0.7 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.title}>{CATEGORY_LABEL[assignment.category]}</Text>
                    <Ionicons name="checkmark-circle" size={18} color={color.civicGreen} />
                  </View>
                  <Text style={styles.summary} numberOfLines={1}>{assignment.issueSummary}</Text>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}

      <Button label="Offline sync queue" variant="secondary" onPress={() => router.push("/sync-queue")} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  statusChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  summary: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
  },
  meta: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
});
