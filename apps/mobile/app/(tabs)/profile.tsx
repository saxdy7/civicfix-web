import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth-context";
import { setReducedMotionOverride, useReducedMotion } from "../../lib/preferences";
import { registerForPushNotifications } from "../../lib/push-notifications";
import { color, fontFamily, fontSize, radius, spacing } from "../../lib/theme";

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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageHeaderTitle}>Citizen Profile</Text>

        {/* Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#ffffff" />
                <Text style={styles.roleText}>{user.roles.map(roleLabel).join(", ") || "Citizen"}</Text>
              </View>
              <View style={styles.trustBadge}>
                <Text style={styles.trustBadgeText}>⚡ 100 Trust Karma</Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI Engine Status Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>CivicFix AI Intelligence</Text>
          <View style={styles.aiInnerRow}>
            <View style={styles.aiIconWrap}>
              <Ionicons name="sparkles" size={18} color="#000000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiModelName}>Groq Llama 3.1 & Vision Engine</Text>
              <Text style={styles.aiModelDetail}>Automatic defect triage, GPS pinning & live SLA</Text>
            </View>
            <View style={styles.activePill}>
              <View style={styles.greenDot} />
              <Text style={styles.activePillText}>Active</Text>
            </View>
          </View>
        </View>

        {/* Notifications & Motion Settings */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>Preferences & Alerts</Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingHint}>Get real-time updates when city crews resolve your issues.</Text>
            </View>
            <Pressable
              style={styles.actionPillBtn}
              onPress={handleToggleNotifications}
            >
              <Text style={styles.actionPillText}>{notifStatus === "granted" ? "Manage" : "Enable"}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Reduce Motion</Text>
              <Text style={styles.settingHint}>Disable spring transitions and map animations.</Text>
            </View>
            <Switch
              value={reducedMotion}
              onValueChange={(v) => setReducedMotionOverride(v)}
              trackColor={{ true: "#ffffff", false: "#27272a" }}
              thumbColor={reducedMotion ? "#000000" : "#8e8e8e"}
            />
          </View>
        </View>

        {/* Privacy Assurance */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>Privacy & Location Security</Text>
          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed" size={16} color="#34d399" />
            <Text style={styles.privacyText}>
              Exact GPS coordinates are encrypted and accessible only to dispatched municipal workers. Public neighborhood feeds display generalized approximate pins.
            </Text>
          </View>
        </View>

        {/* Actions & Sign Out */}
        <View style={{ gap: 10, marginTop: 4 }}>
          {user.role !== "field_worker" ? (
            <Pressable
              style={styles.secondaryActionBtn}
              onPress={() => router.push("/staff-request")}
            >
              <Ionicons name="business-outline" size={16} color="#ffffff" />
              <Text style={styles.secondaryActionBtnText}>Municipal Staff Access Request</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.signOutBtn}
            onPress={signOut}
          >
            <Ionicons name="log-out-outline" size={16} color="#ef4444" />
            <Text style={styles.signOutBtnText}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={styles.version}>CivicFix v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[8] + 20,
    gap: spacing[4],
  },
  pageHeaderTitle: {
    fontSize: 26,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  identityCard: {
    backgroundColor: "#121214",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
    color: "#000000",
  },
  name: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  email: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: 4,
    alignItems: "center",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#18181b",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  roleText: {
    fontSize: 10,
    fontFamily: fontFamily.semibold,
    color: "#ffffff",
  },
  trustBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  trustBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: "#f59e0b",
  },
  sectionCard: {
    backgroundColor: "#121214",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: spacing[3],
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  aiInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  aiModelName: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  aiModelDetail: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    marginTop: 1,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#22c55e",
  },
  activePillText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: "#22c55e",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: "#ffffff",
  },
  settingHint: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    marginTop: 2,
    lineHeight: 15,
  },
  actionPillBtn: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  actionPillText: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: "#000000",
  },
  divider: {
    height: 1,
    backgroundColor: "#1e1e24",
  },
  privacyRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    lineHeight: 17,
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#18181b",
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  signOutBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: "#ef4444",
  },
  version: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
  },
});
