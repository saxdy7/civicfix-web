import { Text, View, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { color, fontSize, spacing } from "../../lib/theme";

export default function ReportConfirmation() {
  const { trackingId } = useLocalSearchParams<{ trackingId: string }>();

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.center}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>Report submitted</Text>
        <Card style={styles.trackingCard}>
          <Text style={styles.trackingLabel}>Tracking ID</Text>
          <Text style={styles.trackingId}>{trackingId}</Text>
        </Card>
        <Text style={styles.body}>
          We'll notify you as your report moves through triage, assignment, and resolution. You
          can follow along any time under My reports.
        </Text>
        <Button
          label="Go to My reports"
          onPress={() => router.replace("/(tabs)/my-reports")}
          style={{ width: "100%" }}
        />
        <Button
          label="Report another issue"
          variant="secondary"
          onPress={() => router.replace("/(tabs)/report")}
          style={{ width: "100%" }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
  },
  checkmark: {
    fontSize: 48,
    color: color.civicGreen,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: color.foreground,
  },
  trackingCard: {
    alignItems: "center",
    width: "100%",
  },
  trackingLabel: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  trackingId: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: color.civicBlue,
  },
  body: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    textAlign: "center",
  },
});
