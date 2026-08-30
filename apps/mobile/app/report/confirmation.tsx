import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { registerForPushNotifications } from "../../lib/push-notifications";
import { fontFamily, fontSize, radius, spacing } from "../../lib/theme";

const NEXT_STEPS = [
  { icon: "eye-outline" as const, label: "A staff member reviews your report" },
  { icon: "person-outline" as const, label: "It's routed to the responsible department" },
  { icon: "notifications-outline" as const, label: "You're notified at every status change" },
];

export default function ReportConfirmation() {
  const { trackingId } = useLocalSearchParams<{ trackingId: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [notifyState, setNotifyState] = useState<"idle" | "asking" | "on" | "denied">("idle");

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const handleEnableNotifications = async () => {
    if (!user) return;
    setNotifyState("asking");
    const result = await registerForPushNotifications(user.id);
    setNotifyState(result.granted ? "on" : "denied");
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.center}>
        <Animated.View style={[styles.checkWrap, { transform: [{ scale }], opacity, backgroundColor: colors.civicGreen }]}>
          <Ionicons name="checkmark" size={40} color="#ffffff" />
        </Animated.View>

        <Text style={[styles.title, { color: colors.foreground }]}>Report submitted</Text>
        <View style={[styles.statusPill, { backgroundColor: colors.civicBlueSoft }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.civicBlue }]} />
          <Text style={[styles.statusText, { color: colors.civicBlue }]}>Reported</Text>
        </View>

        <Card style={styles.trackingCard} tone="muted">
          <Text style={[styles.trackingLabel, { color: colors.mutedForeground }]}>Tracking ID</Text>
          <Text style={[styles.trackingId, { color: colors.foreground }]}>{trackingId}</Text>
        </Card>

        <Card style={{ width: "100%", gap: spacing[3] }}>
          <Text style={[styles.nextTitle, { color: colors.foreground }]}>What happens next</Text>
          {NEXT_STEPS.map((step) => (
            <View key={step.label} style={styles.nextRow}>
              <Ionicons name={step.icon} size={18} color={colors.mutedForeground} />
              <Text style={[styles.nextText, { color: colors.mutedForeground }]}>{step.label}</Text>
            </View>
          ))}
        </Card>

        {notifyState === "idle" ? (
          <Button label="Notify me about this report" variant="secondary" onPress={handleEnableNotifications} />
        ) : notifyState === "asking" ? (
          <Text style={[styles.notifyHint, { color: colors.mutedForeground }]}>Requesting permission…</Text>
        ) : notifyState === "on" ? (
          <Text style={[styles.notifyHintSuccess, { color: colors.civicGreen }]}>You'll be notified about updates.</Text>
        ) : (
          <Text style={[styles.notifyHint, { color: colors.mutedForeground }]}>
            Notifications are off — you can still check status under My reports.
          </Text>
        )}

        <Button
          label="View report"
          size="hero"
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
    gap: spacing[3],
  },
  checkWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  trackingCard: {
    alignItems: "center",
    width: "100%",
    marginTop: spacing[2],
  },
  trackingLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  trackingId: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.5,
  },
  nextTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  nextText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  notifyHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textAlign: "center",
  },
  notifyHintSuccess: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    textAlign: "center",
  },
});
