import { Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Button } from "../../../components/Button";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { MOCK_ASSIGNMENTS } from "../../../lib/mock-data";
import { color, fontSize, spacing } from "../../../lib/theme";

export default function NavigateHandoff() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignment = MOCK_ASSIGNMENTS.find((item) => item.id === id);

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.center}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Map unavailable — Mapbox token not configured.</Text>
        </View>
        <Text style={styles.title}>{assignment?.neighborhood ?? "Assignment location"}</Text>
        <Text style={styles.hint}>
          Hand off to your device's default navigation app to get turn-by-turn directions.
        </Text>
        <Button label="Open in Maps app" onPress={() => {}} style={{ width: "100%" }} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    gap: spacing[4],
  },
  mapPlaceholder: {
    height: 220,
    backgroundColor: color.slate100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  mapPlaceholderText: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    paddingHorizontal: spacing[4],
    textAlign: "center",
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: color.foreground,
    textAlign: "center",
  },
  hint: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    textAlign: "center",
  },
});
