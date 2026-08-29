import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ScreenContainer";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/auth-context";
import { fetchMyIssueById } from "../../lib/repositories/issues";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_SHORT_LABEL } from "../../lib/status";
import { color, fontSize, spacing } from "../../lib/theme";
import type { Issue } from "../../lib/types";

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [issue, setIssue] = useState<Issue | null | undefined>(undefined);

  useEffect(() => {
    if (!user || !id) return;
    fetchMyIssueById(id, user.id).then(setIssue);
  }, [id, user]);

  if (issue === undefined) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <ActivityIndicator color={color.civicBlue} />
      </ScreenContainer>
    );
  }

  if (!issue) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <EmptyState title="Report not found" description="This report may have been removed." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.trackingId}>{issue.trackingId}</Text>
          <StatusBadge status={issue.status} />
        </View>
        <Text style={styles.currentStatus}>{STATUS_LABEL[issue.status]}</Text>
        <Text style={styles.meta}>
          {CATEGORY_LABEL[issue.category]} · {issue.neighborhood}
        </Text>
        <Text style={styles.description}>{issue.description}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Status timeline</Text>
      <Card>
        {issue.events.map((event, index) => (
          <View key={event.id} style={styles.timelineRow}>
            <View style={styles.timelineDotColumn}>
              <View style={styles.timelineDot} />
              {index < issue.events.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing[3] }}>
              <Text style={styles.timelineStatus}>{STATUS_SHORT_LABEL[event.status]}</Text>
              {event.note ? <Text style={styles.timelineNote}>{event.note}</Text> : null}
              <Text style={styles.timelineDate}>{new Date(event.createdAt).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingId: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: color.foreground,
  },
  currentStatus: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: color.civicBlue,
  },
  meta: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
  description: {
    fontSize: fontSize.sm,
    color: color.foreground,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: color.foreground,
  },
  timelineRow: {
    flexDirection: "row",
  },
  timelineDotColumn: {
    alignItems: "center",
    width: 20,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.civicBlue,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: color.border,
  },
  timelineStatus: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: color.foreground,
  },
  timelineNote: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
  },
  timelineDate: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
  },
});
