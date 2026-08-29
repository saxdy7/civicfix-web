import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useAuth } from "../../../lib/auth-context";
import { acceptAssignment, fetchAssignmentById } from "../../../lib/repositories/assignments";
import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "../../../lib/status";
import { color, fontFamily, fontSize, radius, spacing } from "../../../lib/theme";
import type { Assignment } from "../../../lib/types";

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null | undefined>(undefined);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user || !id) return;
    fetchAssignmentById(id, user.id).then(setAssignment);
  }, [id, user]);

  useFocusEffect(load);

  if (assignment === undefined) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <ActivityIndicator color={color.civicBlue} />
      </ScreenContainer>
    );
  }

  if (!assignment) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <EmptyState title="Assignment not found" description="It may have been reassigned." />
      </ScreenContainer>
    );
  }

  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    setError(null);
    const { error: acceptError } = await acceptAssignment(assignment.id, assignment.issueId, user.id);
    setAccepting(false);
    if (acceptError) {
      setError(acceptError);
      return;
    }
    load();
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{CATEGORY_LABEL[assignment.category]}</Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{STATUS_SHORT_LABEL[assignment.status]}</Text>
          </View>
        </View>
        <Text style={styles.summary}>{assignment.issueSummary}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={color.mutedForeground} />
          <Text style={styles.meta}>{assignment.neighborhood} · authorized exact location</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={color.mutedForeground} />
          <Text style={styles.meta}>
            {assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleString()}` : "No due date set"}
          </Text>
        </View>
      </Card>

      {assignment.status === "assigned" ? (
        <Button label={accepting ? "Accepting…" : "Accept assignment"} size="hero" disabled={accepting} onPress={handleAccept} />
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        label="Open in maps"
        variant="secondary"
        onPress={() => router.push({ pathname: "/assignments/[id]/navigate", params: { id: assignment.id } })}
      />

      <Card>
        <Text style={styles.cardTitle}>Resolution evidence</Text>
        <Text style={styles.cardHint}>
          {assignment.afterPhotoCaptured
            ? "Evidence submitted — awaiting administrator verification. You cannot mark this resolved yourself."
            : "Capture before/after photos, then submit for verification."}
        </Text>
        <Button
          label="Capture evidence"
          disabled={assignment.status === "assigned"}
          onPress={() => router.push({ pathname: "/assignments/[id]/evidence", params: { id: assignment.id } })}
        />
      </Card>

      <Card tone="muted" style={styles.safetyCard}>
        <Ionicons name="shield-checkmark-outline" size={18} color={color.civicAmber} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.safetyTitle}>Field safety</Text>
          <Text style={styles.safetyText}>
            Wear visibility gear near traffic, do not enter unstable structures, and reschedule if a
            site looks unsafe. The reporter's contact details are never shared with field staff.
          </Text>
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    color: color.foreground,
  },
  statusChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: color.civicAmberSoft,
  },
  statusChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.civicAmber,
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
  cardTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  cardHint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
  safetyCard: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "flex-start",
  },
  safetyTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  safetyText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 18,
  },
});
