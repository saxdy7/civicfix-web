import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { MOCK_ASSIGNMENTS } from "../../lib/mock-data";
import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "../../lib/status";
import { color, fontSize, spacing } from "../../lib/theme";

export default function Assignments() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <Text style={styles.sectionTitle}>My assignments</Text>
      {MOCK_ASSIGNMENTS.map((assignment) => (
        <Card key={assignment.id} style={{ marginBottom: spacing[3] }}>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>{CATEGORY_LABEL[assignment.category]}</Text>
            <Text style={styles.status}>{STATUS_SHORT_LABEL[assignment.status]}</Text>
          </View>
          <Text style={styles.summary}>{assignment.issueSummary}</Text>
          <Text style={styles.meta}>
            {assignment.neighborhood} · Due {new Date(assignment.dueAt).toLocaleDateString()}
          </Text>
          <Button
            label="Open assignment"
            onPress={() => router.push({ pathname: "/assignments/[id]", params: { id: assignment.id } })}
          />
        </Card>
      ))}
      <Button label="Offline sync queue" variant="secondary" onPress={() => router.push("/sync-queue")} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: color.foreground,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "700",
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
});
