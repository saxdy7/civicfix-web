import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { fetchMyIssues } from "../../lib/repositories/issues";
import { CATEGORY_LABEL } from "../../lib/status";
import { fontFamily, fontSize, radius, spacing } from "../../lib/theme";
import type { Issue } from "../../lib/types";

const ACTIVE_STATUSES = new Set(["reported", "triaged", "assigned", "in_progress", "pending_verification", "reopened"]);
const RESOLVED_STATUSES = new Set(["resolved", "rejected", "duplicate"]);

type Filter = "active" | "resolved" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All Reports" },
];

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const CATEGORY_ICONS: Record<string, string> = {
  pothole: "car-outline",
  garbage: "trash-outline",
  streetlight: "bulb-outline",
  other: "construct-outline",
};

export default function MyReports() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIssues(await fetchMyIssues(user.id));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = issues.filter((i) => {
    if (filter === "active") return ACTIVE_STATUSES.has(i.status);
    if (filter === "resolved") return RESOLVED_STATUSES.has(i.status);
    return true;
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
        }
      >
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>My Reports</Text>
          <Pressable
            style={[styles.newReportBtn, { backgroundColor: colors.inverseBackground }]}
            onPress={() => router.push("/(tabs)/report")}
          >
            <Ionicons name="add" size={18} color={colors.inverseForeground} />
            <Text style={[styles.newReportBtnText, { color: colors.inverseForeground }]}>New</Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {FILTERS.map((f) => {
            const isSelected = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[
                  styles.filterPill,
                  isSelected
                    ? [styles.filterPillActive, { backgroundColor: colors.inverseBackground }]
                    : [styles.filterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
                ]}
                onPress={() => setFilter(f.key)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isSelected ? colors.inverseForeground : colors.foreground },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No reports found"
            description={
              filter === "active"
                ? "You don't have any active issues under municipal review."
                : "No resolved reports yet."
            }
            action={<Button label="File a Report" onPress={() => router.push("/(tabs)/report")} />}
          />
        ) : (
          <View style={styles.cardsList}>
            {filtered.map((issue) => (
              <Pressable
                key={issue.id}
                style={[styles.issueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/reports/[id]", params: { id: issue.id } })}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.categoryIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                    <Ionicons
                      name={(CATEGORY_ICONS[issue.category] as any) || "construct-outline"}
                      size={18}
                      color={colors.foreground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackingIdText, { color: colors.foreground }]}>{issue.trackingId}</Text>
                    <Text style={[styles.categoryText, { color: colors.mutedForeground }]}>
                      {CATEGORY_LABEL[issue.category]} · {issue.neighborhood}
                    </Text>
                  </View>
                  <StatusBadge status={issue.status} />
                </View>

                <Text style={[styles.descriptionText, { color: colors.foreground }]} numberOfLines={2}>
                  {issue.description}
                </Text>

                <View style={styles.cardFooterRow}>
                  <View style={styles.timeWrap}>
                    <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{relativeTime(issue.createdAt)}</Text>
                  </View>
                  <View style={styles.chevronWrap}>
                    <Text style={[styles.viewTrackText, { color: colors.foreground }]}>View Track</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.foreground} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.5,
  },
  newReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  newReportBtnText: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  filterPillActive: {},
  filterPillInactive: {
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  centerContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cardsList: {
    gap: 12,
  },
  issueCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  trackingIdText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 1,
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  timeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
  chevronWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewTrackText: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
  },
});
