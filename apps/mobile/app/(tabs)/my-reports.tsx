import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
import { StatusBadge } from "../../components/StatusBadge";
import { MOCK_ISSUES } from "../../lib/mock-data";
import { CATEGORY_LABEL } from "../../lib/status";
import { color, fontSize, spacing } from "../../lib/theme";

export default function MyReports() {
  const router = useRouter();

  if (MOCK_ISSUES.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          title="No reports yet"
          description="Reports you submit will show up here with live status updates."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {MOCK_ISSUES.map((issue) => (
        <Card key={issue.id} style={{ marginBottom: spacing[3] }}>
          <View style={styles.rowBetween}>
            <Text style={styles.trackingId}>{issue.trackingId}</Text>
            <StatusBadge status={issue.status} />
          </View>
          <Text style={styles.category}>{CATEGORY_LABEL[issue.category]} · {issue.neighborhood}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {issue.description}
          </Text>
          <Button
            label="View status"
            variant="secondary"
            onPress={() => router.push({ pathname: "/reports/[id]", params: { id: issue.id } })}
          />
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingId: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  category: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
  description: {
    fontSize: fontSize.sm,
    color: color.foreground,
  },
});
