import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { StatusBadge } from "../../components/StatusBadge";
import { MOCK_ISSUES } from "../../lib/mock-data";
import { CATEGORY_LABEL } from "../../lib/status";
import { color, fontSize, spacing } from "../../lib/theme";

export default function Home() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderTitle}>Map unavailable</Text>
        <Text style={styles.mapPlaceholderText}>
          No Mapbox token configured yet — showing the nearby issue list instead.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Nearby reports</Text>

      {MOCK_ISSUES.map((issue) => (
        <Card key={issue.id} style={{ marginBottom: spacing[3] }}>
          <View style={styles.rowBetween}>
            <Text style={styles.category}>{CATEGORY_LABEL[issue.category]}</Text>
            <StatusBadge status={issue.status} />
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {issue.description}
          </Text>
          <Text style={styles.meta}>{issue.neighborhood}</Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    backgroundColor: color.slate100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: "dashed",
    padding: spacing[5],
    alignItems: "center",
    gap: spacing[1],
  },
  mapPlaceholderTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  mapPlaceholderText: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    textAlign: "center",
  },
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
  category: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  description: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
  meta: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
  },
});
