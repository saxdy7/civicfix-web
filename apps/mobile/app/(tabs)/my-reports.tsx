import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/auth-context";
import { fetchMyIssues } from "../../lib/repositories/issues";
import { CATEGORY_LABEL } from "../../lib/status";
import { color, fontFamily, fontSize, radius, spacing } from "../../lib/theme";
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

  const filtered = issues.filter((issue) => {
    if (filter === "active") return ACTIVE_STATUSES.has(issue.status);
    if (filter === "resolved") return RESOLVED_STATUSES.has(issue.status);
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />
        }
      >
        {/* Top Header */}
        <View style={styles.topHeaderRow}>
          <View>
            <Text style={styles.sectionHeaderTitle}>My Submissions</Text>
            <Text style={styles.sectionHeaderSub}>
              {issues.length} total report{issues.length === 1 ? "" : "s"} tracked across city departments
            </Text>
          </View>

          <Pressable
            style={styles.newReportBtn}
            onPress={() => router.push("/(tabs)/report")}
          >
            <Ionicons name="add" size={16} color="#000000" />
            <Text style={styles.newReportBtnText}>New</Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterPill, active ? styles.filterPillActive : styles.filterPillInactive]}
              >
                <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Reports List */}
        {loading ? (
          <ActivityIndicator color="#ffffff" style={{ marginTop: spacing[6] }} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={issues.length === 0 ? "No reports yet" : `No ${filter} reports`}
            description={
              issues.length === 0
                ? "Reports you submit will show up here with live vertical milestone tracking."
                : "Try switching to another filter tab above."
            }
            action={issues.length === 0 ? <Button label="Report an issue" onPress={() => router.push("/(tabs)/report")} /> : undefined}
          />
        ) : (
          filtered.map((issue) => (
            <Pressable
              key={issue.id}
              style={styles.issueCard}
              onPress={() => router.push({ pathname: "/reports/[id]", params: { id: issue.id } })}
            >
              <View style={styles.cardTopRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={(CATEGORY_ICONS[issue.category] || "construct-outline") as any}
                    size={16}
                    color="#60a5fa"
                  />
                  <Text style={styles.trackingIdText}>{issue.trackingId}</Text>
                </View>
                <StatusBadge status={issue.status} />
              </View>

              <Text style={styles.categorySubText}>
                {CATEGORY_LABEL[issue.category]} · {issue.neighborhood || "District"} · {relativeTime(issue.createdAt)}
              </Text>

              <Text style={styles.descriptionText} numberOfLines={2}>
                {issue.description}
              </Text>

              <View style={styles.cardBottomRow}>
                <View style={styles.trackMilestoneBtn}>
                  <Text style={styles.trackMilestoneText}>View Status Timeline ➔</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
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
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sectionHeaderTitle: {
    fontSize: 26,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  sectionHeaderSub: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    marginTop: 2,
  },
  newReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  newReportBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: "#000000",
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
  filterPillActive: {
    backgroundColor: "#ffffff",
  },
  filterPillInactive: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  filterPillTextActive: {
    color: "#000000",
  },
  filterPillTextInactive: {
    color: "#8e8e8e",
  },
  issueCard: {
    backgroundColor: "#121214",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingIdText: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  categorySubText: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
    color: "#8e8e8e",
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: "#d4d4d8",
    lineHeight: 18,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  trackMilestoneBtn: {
    backgroundColor: "#18181b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  trackMilestoneText: {
    fontSize: 11,
    fontFamily: fontFamily.semibold,
    color: "#ffffff",
  },
});
