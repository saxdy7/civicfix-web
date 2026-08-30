import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { setReducedMotionOverride, useReducedMotion } from "../../lib/preferences";
import { registerForPushNotifications } from "../../lib/push-notifications";
import { fontFamily, fontSize, radius, spacing } from "../../lib/theme";

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
  const { theme, setTheme, colors, isDark } = useTheme();
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageHeaderTitle, { color: colors.foreground }]}>Citizen Profile</Text>

        {/* Identity Card */}
        <View style={[styles.identityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.inverseBackground }]}>
            <Text style={[styles.avatarText, { color: colors.inverseForeground }]}>{initials(user.name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>{user.name}</Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.foreground} />
                <Text style={[styles.roleText, { color: colors.foreground }]}>{user.roles.map(roleLabel).join(", ") || "Citizen"}</Text>
              </View>
              <View style={styles.trustBadge}>
                <Text style={styles.trustBadgeText}>⚡ 100 Trust Karma</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Theme Mode Selector Card (Default: White Theme) */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="color-palette-outline" size={18} color={colors.foreground} />
            <Text style={[styles.cardHeaderTitle, { color: colors.foreground }]}>App Theme (Appearance)</Text>
          </View>
          <Text style={[styles.settingHint, { color: colors.mutedForeground }]}>
            Choose between crisp White theme (default) or dark OLED mode.
          </Text>

          <View style={styles.themeToggleDeck}>
            <Pressable
              style={[
                styles.themeChoiceBtn,
                theme === "light"
                  ? [styles.themeChoiceBtnActive, { backgroundColor: isDark ? "#27272a" : "#0f172a" }]
                  : [styles.themeChoiceBtnInactive, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }],
              ]}
              onPress={() => setTheme("light")}
            >
              <Ionicons
                name="sunny"
                size={18}
                color={theme === "light" ? "#ffffff" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.themeChoiceBtnText,
                  { color: theme === "light" ? "#ffffff" : colors.foreground },
                ]}
              >
                White Theme (Default)
              </Text>
              {theme === "light" && (
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              )}
            </Pressable>

            <Pressable
              style={[
                styles.themeChoiceBtn,
                theme === "dark"
                  ? [styles.themeChoiceBtnActive, { backgroundColor: isDark ? "#27272a" : "#0f172a" }]
                  : [styles.themeChoiceBtnInactive, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }],
              ]}
              onPress={() => setTheme("dark")}
            >
              <Ionicons
                name="moon"
                size={18}
                color={theme === "dark" ? "#ffffff" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.themeChoiceBtnText,
                  { color: theme === "dark" ? "#ffffff" : colors.foreground },
                ]}
              >
                Dark Theme
              </Text>
              {theme === "dark" && (
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              )}
            </Pressable>
          </View>
        </View>

        {/* AI Engine Status Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardHeaderTitle, { color: colors.foreground }]}>CivicFix AI Intelligence</Text>
          <View style={styles.aiInnerRow}>
            <View style={[styles.aiIconWrap, { backgroundColor: colors.inverseBackground }]}>
              <Ionicons name="sparkles" size={18} color={colors.inverseForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiModelName, { color: colors.foreground }]}>Groq Llama 3.1 & Vision Engine</Text>
              <Text style={[styles.aiModelDetail, { color: colors.mutedForeground }]}>Automatic defect triage, GPS pinning & live SLA</Text>
            </View>
            <View style={styles.activePill}>
              <View style={styles.greenDot} />
              <Text style={styles.activePillText}>Active</Text>
            </View>
          </View>
        </View>

        {/* Notifications & Motion Settings */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardHeaderTitle, { color: colors.foreground }]}>Preferences & Alerts</Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Push Notifications</Text>
              <Text style={[styles.settingHint, { color: colors.mutedForeground }]}>Get real-time updates when city crews resolve your issues.</Text>
            </View>
            <Pressable
              style={[styles.actionPillBtn, { backgroundColor: colors.inverseBackground }]}
              onPress={handleToggleNotifications}
            >
              <Text style={[styles.actionPillText, { color: colors.inverseForeground }]}>{notifStatus === "granted" ? "Manage" : "Enable"}</Text>
            </Pressable>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Reduce Motion</Text>
              <Text style={[styles.settingHint, { color: colors.mutedForeground }]}>Disable spring transitions and map animations.</Text>
            </View>
            <Switch
              value={reducedMotion}
              onValueChange={(v) => setReducedMotionOverride(v)}
              trackColor={{ true: colors.foreground, false: colors.surfaceMuted }}
              thumbColor={reducedMotion ? colors.inverseForeground : colors.mutedForeground}
            />
          </View>
        </View>

        {/* Privacy Assurance */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardHeaderTitle, { color: colors.foreground }]}>Privacy & Location Security</Text>
          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed" size={16} color="#16a34a" />
            <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
              Exact GPS coordinates are encrypted and accessible only to dispatched municipal workers. Public neighborhood feeds display generalized approximate pins.
            </Text>
          </View>
        </View>

        {/* Actions & Sign Out */}
        <View style={{ gap: 10, marginTop: 4 }}>
          {user.role !== "field_worker" ? (
            <Pressable
              style={[styles.secondaryActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/staff-request")}
            >
              <Ionicons name="business-outline" size={16} color={colors.foreground} />
              <Text style={[styles.secondaryActionBtnText, { color: colors.foreground }]}>Municipal Staff Access Request</Text>
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

        <Text style={[styles.version, { color: colors.dimForeground }]}>CivicFix v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
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
    letterSpacing: -0.5,
  },
  identityCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
  },
  name: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
  },
  email: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 10,
    fontFamily: fontFamily.semibold,
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
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: spacing[3],
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  themeToggleDeck: {
    gap: 8,
    marginTop: 4,
  },
  themeChoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  themeChoiceBtnActive: {
    borderColor: "transparent",
  },
  themeChoiceBtnInactive: {},
  themeChoiceBtnText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontFamily: fontFamily.semibold,
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
    alignItems: "center",
    justifyContent: "center",
  },
  aiModelName: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  aiModelDetail: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
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
  },
  settingHint: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    lineHeight: 15,
  },
  actionPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  actionPillText: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
  },
  divider: {
    height: 1,
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
    lineHeight: 17,
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
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
    textAlign: "center",
    marginTop: 4,
  },
});
