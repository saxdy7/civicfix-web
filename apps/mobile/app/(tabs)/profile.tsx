import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { Linking, Switch, Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { useAuth } from "../../lib/auth-context";
import { setReducedMotionOverride, useReducedMotion } from "../../lib/preferences";
import { registerForPushNotifications } from "../../lib/push-notifications";
import { color, fontFamily, fontSize, spacing } from "../../lib/theme";

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const reducedMotion = useReducedMotion();
  const [notifStatus, setNotifStatus] = useState<Notifications.PermissionStatus | null>(null);

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setNotifStatus(p.status));
  }, []);

  if (!user) return null;

  const handleToggleNotifications = async () => {
    if (notifStatus === "granted") {
      Linking.openSettings();
      return;
    }
    const result = await registerForPushNotifications(user.id);
    setNotifStatus(result.granted ? Notifications.PermissionStatus.GRANTED : Notifications.PermissionStatus.DENIED);
  };

  return (
    <ScreenContainer>
      <Card style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
      </Card>

      <View style={styles.roleRow}>
        <Ionicons name="shield-outline" size={16} color={color.mutedForeground} />
        <Text style={styles.roleText}>
          {user.roles.map(roleLabel).join(", ") || "Citizen"}
        </Text>
      </View>
      {/*
        Role is intentionally read-only — granted only via user_roles in
        Supabase by an administrator or the signup trigger. There is no
        self-service way to change it here; that was the old build's most
        dangerous shortcut and it has been removed entirely.
      */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Card style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Push notifications</Text>
            <Text style={styles.settingHint}>
              {notifStatus === "granted"
                ? "Enabled — you'll be notified about status changes."
                : notifStatus === "denied"
                  ? "Off — enable in Settings to get notified."
                  : "Get notified when a report you filed changes status."}
            </Text>
          </View>
          <Button
            label={notifStatus === "granted" ? "Manage" : "Enable"}
            variant="secondary"
            onPress={handleToggleNotifications}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <Card style={{ gap: spacing[1] }}>
          <View style={styles.privacyRow}>
            <Ionicons name="location-outline" size={16} color={color.mutedForeground} />
            <Text style={styles.settingHint}>
              Your exact coordinates and contact details are visible only to authorized staff. Public
              maps show a generalized area.
            </Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accessibility</Text>
        <Card style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Reduce motion</Text>
            <Text style={styles.settingHint}>Turns off ripple, spring, and transition animations.</Text>
          </View>
          <Switch
            value={reducedMotion}
            onValueChange={(v) => setReducedMotionOverride(v)}
            trackColor={{ true: color.civicBlue, false: color.surfaceMuted }}
          />
        </Card>
      </View>

      {user.role !== "field_worker" ? (
        <View style={styles.section}>
          <Button
            label="Municipal employee? Request staff access"
            variant="secondary"
            onPress={() => router.push("/staff-request")}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Button
          label="Accessibility & privacy details"
          variant="secondary"
          onPress={() => Linking.openURL("https://civicfix-web.vercel.app/accessibility")}
        />
        <Button
          label="Help & support"
          variant="secondary"
          onPress={() => Linking.openURL("mailto:support@civicfix.city")}
        />
        <Button label="Sign out" variant="danger" onPress={signOut} />
      </View>

      <Text style={styles.version}>CivicFix v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: color.inverseBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: color.inverseForeground,
  },
  name: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    color: color.foreground,
  },
  email: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    alignSelf: "flex-start",
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 999,
  },
  roleText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.mutedForeground,
  },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
    color: color.foreground,
  },
  settingHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    marginTop: 2,
  },
  privacyRow: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "flex-start",
  },
  version: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.dimForeground,
    textAlign: "center",
    marginTop: spacing[2],
  },
});
