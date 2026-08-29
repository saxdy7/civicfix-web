import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
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
  { key: "all", label: "All" },
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
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.foreground} />}>
      <Text style={styles.pageTitle}>My reports</Text>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={color.civicBlue} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={issues.length === 0 ? "No reports yet" : `No ${filter} reports`}
          description={
            issues.length === 0
              ? "Reports you submit will show up here with live status updates."
              : "Try a different filter."
          }
          action={issues.length === 0 ? <Button label="Report an issue" onPress={() => router.push("/(tabs)/report")} /> : undefined}
        />
      ) : (
        filtered.map((issue) => (
          <Card key={issue.id} style={{ marginBottom: spacing[3] }}>
            <View style={styles.rowBetween}>
              <Text style={styles.trackingId}>{issue.trackingId}</Text>
              <StatusBadge status={issue.status} />
            </View>
            <Text style={styles.category}>
              {CATEGORY_LABEL[issue.category]} · {issue.neighborhood} · {relativeTime(issue.createdAt)}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {issue.description}
            </Text>
            <Button
              label="View status"
              variant="secondary"
              onPress={() => router.push({ pathname: "/reports/[id]", params: { id: issue.id } })}
            />
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    letterSpacing: -0.4,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing[2],
    backgroundColor: color.surfaceMuted,
    padding: 4,
    borderRadius: radius.pill,
  },
  filterChip: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: color.inverseBackground,
  },
  filterLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.mutedForeground,
  },
  filterLabelActive: {
    color: color.inverseForeground,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingId: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  category: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  description: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.foreground,
  },
});
