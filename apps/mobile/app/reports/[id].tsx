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
import { deleteIssue, fetchMyIssueById } from "../../lib/repositories/issues";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_SHORT_LABEL } from "../../lib/status";
import { color, fontFamily, fontSize, radius, spacing } from "../../lib/theme";
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
    icon: "send",
    statusMatch: ["triaged", "assigned", "in_progress", "pending_verification", "resolved"],
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

export default function ReportDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [issue, setIssue] = useState<Issue | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user || !id) return;
      fetchMyIssueById(id, user.id).then(setIssue);
    }, [id, user]),
  );

  const confirmDelete = () => {
    if (!issue) return;
    Alert.alert(
      "Delete Report?",
      `Are you sure you want to delete report ${issue.trackingId}? This will cancel and remove your submission.`,
      [
        { text: "Keep Report", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const { error: delErr } = await deleteIssue(issue.id);
            if (delErr) {
              Alert.alert("Error", delErr);
              setDeleting(false);
            } else {
              router.push("/(tabs)/my-reports");
            }
          },
        },
      ],
    );
  };

  if (issue === undefined) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ffffff" size="large" />
      </SafeAreaView>
    );
  }

  if (!issue || !user) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <EmptyState title="Report not found" description="This report may have been removed or deleted." />
      </SafeAreaView>
    );
  }

  // Calculate which stages are completed, active, or upcoming
  const getStageState = (stageIndex: number) => {
    const stage = LIFECYCLE_STAGES[stageIndex];
    const isPastOrCurrent = stage.statusMatch.includes(issue.status);

    if (issue.status === "resolved") {
      return "completed";
    }

    if (issue.status === "rejected") {
      return stageIndex === 0 ? "completed" : "pending";
    }

    // Determine exact active index based on status
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Navigation Header */}
        <View style={styles.navHeader}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Report Status</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Report ID & Badge Card */}
        <View style={styles.reportSummaryCard}>
          <View style={styles.summaryTopRow}>
            <Text style={styles.trackingIdText}>{issue.trackingId}</Text>
            <StatusBadge status={issue.status} />
          </View>
          <Text style={styles.statusSubhead}>{STATUS_LABEL[issue.status]}</Text>
          <Text style={styles.metaRow}>
            {CATEGORY_LABEL[issue.category]} · {issue.neighborhood}
          </Text>
          <Text style={styles.descriptionText}>"{issue.description}"</Text>
        </View>

        {/* Section Heading */}
        <View style={styles.trackHeaderSection}>
          <Text style={styles.trackSectionTitle}>Resolution Track</Text>
          <Text style={styles.trackSectionSub}>
            Live municipal SLA pipeline and verification milestones
          </Text>
        </View>

        {/* VERTICAL STEPPER TRACK (Exact Pinterest pattern) */}
        <View style={styles.stepperContainer}>
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const state = getStageState(idx);
            const isLast = idx === LIFECYCLE_STAGES.length - 1;
            const nextState = !isLast ? getStageState(idx + 1) : "pending";

            return (
              <View key={stage.key} style={styles.stepperItemRow}>
                {/* Left Track Column: Node Circle + Vertical Connecting Line */}
                <View style={styles.trackColumn}>
                  {/* Circle Node */}
                  {state === "completed" ? (
                    <View style={styles.nodeCircleCompleted}>
                      <Ionicons name="checkmark" size={16} color="#000000" />
                    </View>
                  ) : state === "active" ? (
                    <View style={styles.nodeCircleActive}>
                      <Ionicons name={stage.icon} size={15} color="#ffffff" />
                    </View>
                  ) : (
                    <View style={styles.nodeCirclePending}>
                      <Ionicons name={stage.icon} size={14} color="#64748b" />
                    </View>
                  )}

                  {/* Vertical Line to next stage */}
                  {!isLast && (
                    <View
                      style={[
                        styles.trackLine,
                        state === "completed" && (nextState === "completed" || nextState === "active")
                          ? styles.trackLineSolid
                          : styles.trackLineMuted,
                      ]}
                    />
                  )}
                </View>

                {/* Right Content Column: Stage Title + Subtitle */}
                <View style={[styles.stageContentCol, isLast ? { paddingBottom: 0 } : null]}>
                  <Text
                    style={[
                      styles.stageTitle,
                      state === "completed" || state === "active"
                        ? styles.stageTitleActive
                        : styles.stageTitlePending,
                    ]}
                  >
                    {stage.title}
                  </Text>
                  <Text style={styles.stageSubtitle}>{stage.subtitle}</Text>

                  {/* If active, display live badge */}
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

        {/* BOTTOM DOCKED CARD (Matching inspiration bottom sheet) */}
        <View style={styles.bottomCardContainer}>
          <Text style={styles.bottomCardHeader}>⚡ Guaranteed Municipal SLA</Text>
          <Text style={styles.bottomCardSub}>
            Estimated Resolution: Within 24–48 Hours
          </Text>

          {/* Action Button */}
          <Pressable
            style={styles.bottomPrimaryBtn}
            onPress={() => setShowChat((v) => !v)}
          >
            <Ionicons name={showChat ? "chevron-up" : "chatbubble-ellipses"} size={18} color="#000000" />
            <Text style={styles.bottomPrimaryBtnText}>
              {showChat ? "Hide Department Chat" : "Message Department Dispatch"}
            </Text>
          </Pressable>

          {/* Assurance Tag */}
          <View style={styles.assuranceRow}>
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
            <Text style={styles.assuranceText}>100% Transparent Municipal SLA · Verified Proof</Text>
          </View>

          {/* Delete Action */}
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
        {showChat && (
          <View style={styles.chatDrawerCard}>
            <Text style={styles.chatDrawerTitle}>Live Department Dispatch</Text>
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
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
    paddingBottom: spacing[8] + 20,
    gap: spacing[4],
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[2],
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#18181b",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  reportSummaryCard: {
    backgroundColor: "#121214",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 6,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingIdText: {
    fontSize: 22,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  statusSubhead: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: "#8fb4ff",
  },
  metaRow: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: "#d4d4d8",
    fontStyle: "italic",
    marginTop: 4,
  },
  trackHeaderSection: {
    paddingTop: spacing[2],
    gap: 2,
  },
  trackSectionTitle: {
    fontSize: 20,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  trackSectionSub: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
  },
  stepperContainer: {
    backgroundColor: "#0a0a0c",
    borderRadius: 24,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: "#1e1e24",
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
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  nodeCircleActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    zIndex: 10,
  },
  nodeCirclePending: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#121214",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272a",
    zIndex: 10,
  },
  trackLine: {
    width: 3,
    flex: 1,
    minHeight: 48,
    marginVertical: -2,
  },
  trackLineSolid: {
    backgroundColor: "#ffffff",
  },
  trackLineMuted: {
    backgroundColor: "#27272a",
  },
  stageContentCol: {
    flex: 1,
    paddingLeft: spacing[3],
    paddingBottom: spacing[5],
    justifyContent: "flex-start",
  },
  stageTitle: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    marginTop: 6,
  },
  stageTitleActive: {
    color: "#ffffff",
  },
  stageTitlePending: {
    color: "#64748b",
  },
  stageSubtitle: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    lineHeight: 16,
    marginTop: 3,
  },
  currentActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  liveActiveText: {
    fontSize: 10,
    fontFamily: fontFamily.semibold,
    color: "#22c55e",
  },
  bottomCardContainer: {
    backgroundColor: "#121214",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[2],
  },
  bottomCardHeader: {
    fontSize: 17,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    textAlign: "center",
  },
  bottomCardSub: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    textAlign: "center",
    marginBottom: spacing[2],
  },
  bottomPrimaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bottomPrimaryBtnText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: "#000000",
  },
  assuranceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[2],
  },
  assuranceText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: "#8e8e8e",
  },
  deleteLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing[2],
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteLinkText: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
    color: "#ef4444",
  },
  chatDrawerCard: {
    backgroundColor: "#121214",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: spacing[3],
  },
  chatDrawerTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
});
