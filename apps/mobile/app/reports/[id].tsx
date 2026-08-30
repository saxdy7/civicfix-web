import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { IssueChat } from "../../components/IssueChat";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { deleteIssue, fetchMyIssueById } from "../../lib/repositories/issues";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_SHORT_LABEL } from "../../lib/status";
import { fontFamily, fontSize, radius, spacing } from "../../lib/theme";
import type { Issue, IssueStatus } from "../../lib/types";

interface LifecycleStage {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  statusMatch: IssueStatus[];
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    key: "intake",
    title: "1. Intake & AI Triage",
    subtitle: "Report received, GPS location pinned, and AI categorized.",
    icon: "document-text",
    statusMatch: ["reported", "triaged", "assigned", "in_progress", "pending_verification", "resolved"],
  },
  {
    key: "dispatch",
    title: "2. Department Dispatch",
    subtitle: "Assigned to municipal field crew with active SLA countdown.",
    icon: "navigate",
    statusMatch: ["assigned", "in_progress", "pending_verification", "resolved"],
  },
  {
    key: "repair",
    title: "3. On-Site Active Repair",
    subtitle: "Technicians on location executing repair and capturing photo proof.",
    icon: "construct",
    statusMatch: ["in_progress", "pending_verification", "resolved"],
  },
  {
    key: "verification",
    title: "4. Community Verification",
    subtitle: "Before & After proof submitted. Citizen quorum certifies final closure.",
    icon: "star",
    statusMatch: ["pending_verification", "resolved"],
  },
];

export default function ReportStatus() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    setIssue(await fetchMyIssueById(id, user.id));
  }, [id, user]);

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

  const confirmDelete = () => {
    Alert.alert(
      "Delete Report?",
      "Are you sure you want to delete this civic report? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!id || !user) return;
            setDeleting(true);
            const res = await deleteIssue(id);
            setDeleting(false);
            if (res && "error" in res && res.error) {
              Alert.alert("Error", res.error);
              return;
            }
            router.replace("/(tabs)/my-reports");
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      </SafeAreaView>
    );
  }

  if (!issue) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
        <EmptyState
          title="Report Not Found"
          description="This report may have been deleted or does not belong to your account."
          action={<Pressable style={[styles.bottomPrimaryBtn, { backgroundColor: colors.inverseBackground, marginTop: 12, paddingHorizontal: 20 }]} onPress={() => router.replace("/(tabs)/my-reports")}><Text style={[styles.bottomPrimaryBtnText, { color: colors.inverseForeground }]}>Go to My Reports</Text></Pressable>}
        />
      </SafeAreaView>
    );
  }

  const getStageState = (stageIndex: number): "completed" | "active" | "pending" => {
    if (issue.status === "resolved") {
      return "completed";
    }

    if (issue.status === "rejected") {
      return stageIndex === 0 ? "completed" : "pending";
    }

    let activeIdx = 0;
    if (issue.status === "reported") activeIdx = 0;
    else if (issue.status === "triaged" || issue.status === "assigned") activeIdx = 1;
    else if (issue.status === "in_progress") activeIdx = 2;
    else if (issue.status === "pending_verification") activeIdx = 3;

    if (stageIndex < activeIdx) return "completed";
    if (stageIndex === activeIdx) return "active";
    return "pending";
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Navigation Header */}
        <View style={styles.navHeader}>
          <Pressable
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
            <Text style={[styles.backButtonText, { color: colors.foreground }]}>Back</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Report Status</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Report ID & Badge Card */}
        <View style={[styles.reportSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryTopRow}>
            <Text style={[styles.trackingIdText, { color: colors.foreground }]}>{issue.trackingId}</Text>
            <StatusBadge status={issue.status} />
          </View>
          <Text style={[styles.statusSubhead, { color: colors.foreground }]}>{STATUS_LABEL[issue.status]}</Text>
          <Text style={[styles.metaRow, { color: colors.mutedForeground }]}>
            {CATEGORY_LABEL[issue.category]} · {issue.neighborhood}
          </Text>
          <Text style={[styles.descriptionText, { color: colors.foreground }]}>"{issue.description}"</Text>
        </View>

        {/* Section Heading */}
        <View style={styles.trackHeaderSection}>
          <Text style={[styles.trackSectionTitle, { color: colors.foreground }]}>Resolution Track</Text>
          <Text style={[styles.trackSectionSub, { color: colors.mutedForeground }]}>
            Live municipal SLA pipeline and verification milestones
          </Text>
        </View>

        {/* VERTICAL STEPPER TRACK */}
        <View style={styles.stepperContainer}>
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const state = getStageState(idx);
            const isLast = idx === LIFECYCLE_STAGES.length - 1;
            const nextState = !isLast ? getStageState(idx + 1) : "pending";

            return (
              <View key={stage.key} style={styles.stepperItemRow}>
                {/* Left Track Column */}
                <View style={styles.trackColumn}>
                  {state === "completed" ? (
                    <View style={[styles.nodeCircleCompleted, { backgroundColor: colors.inverseBackground }]}>
                      <Ionicons name="checkmark" size={16} color={colors.inverseForeground} />
                    </View>
                  ) : state === "active" ? (
                    <View style={[styles.nodeCircleActive, { backgroundColor: colors.inverseBackground }]}>
                      <Ionicons name={stage.icon} size={15} color={colors.inverseForeground} />
                    </View>
                  ) : (
                    <View style={[styles.nodeCirclePending, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                      <Ionicons name={stage.icon} size={14} color={colors.dimForeground} />
                    </View>
                  )}

                  {!isLast && (
                    <View
                      style={[
                        styles.trackLine,
                        state === "completed" && (nextState === "completed" || nextState === "active")
                          ? [styles.trackLineSolid, { backgroundColor: colors.foreground }]
                          : [styles.trackLineMuted, { backgroundColor: colors.border }],
                      ]}
                    />
                  )}
                </View>

                {/* Right Content Column */}
                <View style={[styles.stageContentCol, isLast ? { paddingBottom: 0 } : null]}>
                  <Text
                    style={[
                      styles.stageTitle,
                      { color: state === "completed" || state === "active" ? colors.foreground : colors.mutedForeground },
                    ]}
                  >
                    {stage.title}
                  </Text>
                  <Text style={[styles.stageSubtitle, { color: colors.mutedForeground }]}>{stage.subtitle}</Text>

                  {state === "active" ? (
                    <View style={styles.currentActiveBadge}>
                      <View style={styles.liveGreenDot} />
                      <Text style={styles.liveActiveText}>Active Stage · In Progress</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* BOTTOM DOCKED CARD */}
        <View style={[styles.bottomCardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bottomCardHeader, { color: colors.foreground }]}>⚡ Guaranteed Municipal SLA</Text>
          <Text style={[styles.bottomCardSub, { color: colors.mutedForeground }]}>
            Estimated Resolution: Within 24–48 Hours
          </Text>

          <Pressable
            style={[styles.bottomPrimaryBtn, { backgroundColor: colors.inverseBackground }]}
            onPress={() => setShowChat((v) => !v)}
          >
            <Ionicons name={showChat ? "chevron-up" : "chatbubble-ellipses"} size={18} color={colors.inverseForeground} />
            <Text style={[styles.bottomPrimaryBtnText, { color: colors.inverseForeground }]}>
              {showChat ? "Hide Department Chat" : "Message Department Dispatch"}
            </Text>
          </Pressable>

          <View style={styles.assuranceRow}>
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text style={[styles.assuranceText, { color: colors.mutedForeground }]}>100% Transparent Municipal SLA · Verified Proof</Text>
          </View>

          <Pressable
            style={styles.deleteLinkBtn}
            disabled={deleting}
            onPress={confirmDelete}
          >
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
            <Text style={styles.deleteLinkText}>
              {deleting ? "Deleting report…" : "Delete this report"}
            </Text>
          </Pressable>
        </View>

        {/* Department Chat Drawer */}
        {showChat && user && (
          <View style={[styles.chatDrawerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.chatDrawerTitle, { color: colors.foreground }]}>Live Department Dispatch</Text>
            <IssueChat issueId={issue.id} currentUserId={user.id} senderRole="resident" />
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
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[1],
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fontFamily.bold,
  },
  reportSummaryCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 6,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingIdText: {
    fontSize: 20,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.3,
  },
  statusSubhead: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
  },
  metaRow: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    fontStyle: "italic",
    marginTop: 4,
  },
  trackHeaderSection: {
    gap: 2,
    marginTop: spacing[2],
  },
  trackSectionTitle: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
  },
  trackSectionSub: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  stepperContainer: {
    paddingLeft: 4,
    marginTop: spacing[2],
  },
  stepperItemRow: {
    flexDirection: "row",
  },
  trackColumn: {
    alignItems: "center",
    width: 44,
  },
  nodeCircleCompleted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeCircleActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  nodeCirclePending: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  trackLine: {
    width: 2,
    flex: 1,
    minHeight: 44,
    marginVertical: 4,
  },
  trackLineSolid: {},
  trackLineMuted: {},
  stageContentCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 28,
    gap: 3,
  },
  stageTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  stageSubtitle: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    lineHeight: 15,
  },
  currentActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  liveActiveText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: "#22c55e",
  },
  bottomCardContainer: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: spacing[3],
  },
  bottomCardHeader: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  bottomCardSub: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  bottomPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  bottomPrimaryBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  assuranceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingTop: 2,
  },
  assuranceText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
  },
  deleteLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  deleteLinkText: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
    color: "#ef4444",
  },
  chatDrawerCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  chatDrawerTitle: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
});
