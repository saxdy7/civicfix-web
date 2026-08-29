import { useCallback, useState } from "react";
import { RefreshControl, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/auth-context";
import { confirmIssue, fetchMyConfirmedIssueIds, fetchMyIssues, fetchNearbyPublicIssues } from "../../lib/repositories/issues";
import { fetchMyNotifications } from "../../lib/repositories/notifications";
import { CATEGORY_LABEL } from "../../lib/status";
import { color, fontFamily, fontSize, spacing } from "../../lib/theme";
import type { AppNotification, Issue } from "../../lib/types";

const ACTIVE_STATUSES = new Set(["reported", "triaged", "assigned", "in_progress", "pending_verification", "reopened"]);

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [nearby, setNearby] = useState<Issue[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [issues, nearbyIssues, confirmed, notes] = await Promise.all([
      fetchMyIssues(user.id),
      fetchNearbyPublicIssues(),
      fetchMyConfirmedIssueIds(user.id),
      fetchMyNotifications(user.id),
    ]);
    setMyIssues(issues);
    setNearby(nearbyIssues);
    setConfirmedIds(confirmed);
    setNotifications(notes);
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

  const activeIssues = myIssues.filter((i) => ACTIVE_STATUSES.has(i.status));
  const confirmable = nearby.find((i) => i.reporterId && i.reporterId !== user?.id && !confirmedIds.has(i.id));

  const handleConfirm = async () => {
    if (!confirmable || !user) return;
    setConfirming(true);
    const { error } = await confirmIssue(confirmable.id, user.id);
    setConfirming(false);
    if (!error) setConfirmedIds((prev) => new Set(prev).add(confirmable.id));
  };

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.foreground} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}{user ? `, ${user.name.split(" ")[0]}` : ""}</Text>
          <Text style={styles.summary}>
            {activeIssues.length === 0
              ? "No active reports right now."
              : `${activeIssues.length} active report${activeIssues.length === 1 ? "" : "s"} in progress.`}
          </Text>
        </View>
        <Button
          label="Report"
          size="hero"
          onPress={() => router.push("/(tabs)/report")}
          style={styles.headerCta}
        />
      </View>

      {/* Active reports */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your active reports</Text>
          {myIssues.length > 0 ? (
            <Text style={styles.sectionLink} onPress={() => router.push("/(tabs)/my-reports")}>
              See all
            </Text>
          ) : null}
        </View>

        {loading ? null : activeIssues.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title={myIssues.length === 0 ? "No reports yet" : "All caught up"}
            description={
              myIssues.length === 0
                ? "Report a civic issue and track it here from submission to resolution."
                : "Nothing currently active — resolved reports are under My reports."
            }
            action={<Button label="Report an issue" onPress={() => router.push("/(tabs)/report")} />}
          />
        ) : (
          activeIssues.slice(0, 3).map((issue) => (
            <Card key={issue.id} style={{ marginBottom: spacing[3] }}>
              <View style={styles.rowBetween}>
                <Text style={styles.trackingId}>{issue.trackingId}</Text>
                <StatusBadge status={issue.status} />
              </View>
              <Text style={styles.category}>{CATEGORY_LABEL[issue.category]} · {issue.neighborhood}</Text>
              <Text style={styles.description} numberOfLines={1}>
                {issue.description}
              </Text>
              <Button
                label="View progress"
                variant="secondary"
                onPress={() => router.push({ pathname: "/reports/[id]", params: { id: issue.id } })}
              />
            </Card>
          ))
        )}
      </View>

      {/* Community confirmation */}
      {confirmable ? (
        <Card tone="muted" style={styles.confirmCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.confirmTitle}>Seeing this too?</Text>
            <StatusBadge status={confirmable.status} />
          </View>
          <Text style={styles.confirmBody} numberOfLines={2}>
            {CATEGORY_LABEL[confirmable.category]} reported near {confirmable.neighborhood} —{" "}
            {confirmable.description}
          </Text>
          <Button
            label={confirming ? "Confirming…" : "Confirm — I see this too"}
            variant="secondary"
            disabled={confirming}
            onPress={handleConfirm}
          />
        </Card>
      ) : null}

      {/* Nearby activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Nearby civic activity</Text>
        </View>
        {nearby.length === 0 ? (
          <EmptyState icon="map-outline" title="Nothing reported nearby" description="Public reports in your area will appear here." />
        ) : (
          nearby.slice(0, 3).map((issue) => (
            <View key={issue.id} style={styles.nearbyRow}>
              <View style={[styles.nearbyDot, { backgroundColor: color.civicBlue }]} />
              <Text style={styles.nearbyText} numberOfLines={1}>
                {CATEGORY_LABEL[issue.category]} · {issue.neighborhood}
              </Text>
              <StatusBadge status={issue.status} />
            </View>
          ))
        )}
      </View>

      {/* Notifications preview */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent notifications</Text>
          <Text style={styles.sectionLink} onPress={() => router.push("/notifications")}>
            See all
          </Text>
        </View>
        {notifications.length === 0 ? (
          <EmptyState icon="notifications-outline" title="Nothing yet" description="Status updates will show up here." />
        ) : (
          notifications.slice(0, 2).map((n) => (
            <View key={n.id} style={styles.notifRow}>
              <Ionicons name={n.read ? "mail-open-outline" : "mail-unread-outline"} size={16} color={color.mutedForeground} />
              <Text style={styles.notifText} numberOfLines={1}>
                {n.title}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  greeting: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    letterSpacing: -0.4,
  },
  summary: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    marginTop: 2,
  },
  headerCta: {
    paddingHorizontal: spacing[4],
  },
  section: {
    gap: spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  sectionLink: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicBlue,
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
  confirmCard: {
    gap: spacing[2],
  },
  confirmTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  confirmBody: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 20,
  },
  nearbyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  nearbyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nearbyText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.foreground,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  notifText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.foreground,
  },
});
