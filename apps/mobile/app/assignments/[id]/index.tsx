import { Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { MOCK_ASSIGNMENTS } from "../../../lib/mock-data";
import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "../../../lib/status";
import { color, fontSize, spacing } from "../../../lib/theme";

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const assignment = MOCK_ASSIGNMENTS.find((item) => item.id === id);

  if (!assignment) {
    return (
      <ScreenContainer>
        <EmptyState title="Assignment not found" description="It may have been reassigned." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{CATEGORY_LABEL[assignment.category]}</Text>
          <Text style={styles.status}>{STATUS_SHORT_LABEL[assignment.status]}</Text>
        </View>
        <Text style={styles.summary}>{assignment.issueSummary}</Text>
        <Text style={styles.meta}>{assignment.neighborhood}</Text>
        <Text style={styles.meta}>Due {new Date(assignment.dueAt).toLocaleString()}</Text>
      </Card>

      <Button
        label="Open in maps"
        variant="secondary"
        onPress={() => router.push({ pathname: "/assignments/[id]/navigate", params: { id: assignment.id } })}
      />

      <Card>
        <Text style={styles.cardTitle}>Resolution evidence</Text>
        <Text style={styles.cardHint}>
          Before photo {assignment.beforePhotoCaptured ? "captured ✓" : "not captured"} · After
          photo {assignment.afterPhotoCaptured ? "captured ✓" : "not captured"}
        </Text>
        <Button
          label="Capture evidence"
          onPress={() => router.push({ pathname: "/assignments/[id]/evidence", params: { id: assignment.id } })}
        />
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
    fontWeight: "800",
    color: color.foreground,
  },
  status: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: color.civicAmber,
  },
  summary: {
    fontSize: fontSize.sm,
    color: color.foreground,
  },
  meta: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  cardHint: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
});
