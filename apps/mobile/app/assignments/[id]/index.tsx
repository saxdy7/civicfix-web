import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { IssueChat } from "../../../components/IssueChat";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useAuth } from "../../../lib/auth-context";
import { acceptAssignment, fetchAssignmentById } from "../../../lib/repositories/assignments";
import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "../../../lib/status";
import { color, fontFamily, fontSize, radius, spacing } from "../../../lib/theme";
import type { Assignment, IssueStatus } from "../../../lib/types";

const SOP_GUIDES: Record<string, { steps: string[]; tools: string[] }> = {
  pothole: {
    tools: ["Vibratory tamper", "Cold/hot mix asphalt", "Tack coat", "6x Traffic cones", "Asphalt shovel"],
    steps: [
      "1. Deploy safety cones around work zone",
      "2. Clear loose debris & chisel edges square",
      "3. Apply tack coat & tamp asphalt in layers",
      "4. Seal perimeter & test surface flushness",
      "5. Capture clear 'After' photo for verification",
    ],
  },
  garbage: {
    tools: ["Heavy-duty gloves", "Industrial waste bags", "Debris scoop", "Pressure washer / sanitizer"],
    steps: [
      "1. Inspect area for hazardous or sharp objects",
      "2. Collect and bag scattered debris",
      "3. Inspect & empty receptacle / replace liner",
      "4. Pressure-wash pavement & sanitize",
      "5. Capture clear 'After' photo of clean site",
    ],
  },
  streetlight: {
    tools: ["Bucket truck / ladder", "Digital multimeter", "LED module / photocell", "Insulated hand tools"],
    steps: [
      "1. Lockout/tagout circuit & test voltage",
      "2. Ascend to fixture & test photocell",
      "3. Replace luminaire or ballast module",
      "4. Re-energize & verify illuminated operation",
      "5. Capture photo of working streetlight with pole ID",
    ],
  },
  other: {
    tools: ["Municipal inspection kit", "Digital measure", "Barrier tape", "Evidence camera"],
    steps: [
      "1. Conduct site diagnostic & hazard check",
      "2. Secure perimeter if unsafe for public",
      "3. Execute required municipal repair",
      "4. Verify code compliance & durability",
      "5. Take 'After' photo & submit work report",
    ],
  },
};

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null | undefined>(undefined);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user || !id) return;
    fetchAssignmentById(id, user.id).then(setAssignment);
  }, [id, user]);

  useFocusEffect(load);

  if (assignment === undefined) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <ActivityIndicator color={color.civicBlue} />
      </ScreenContainer>
    );
  }

  if (!assignment) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <EmptyState title="Assignment not found" description="It may have been reassigned." />
      </ScreenContainer>
    );
  }

  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    setError(null);
    const { error: acceptError } = await acceptAssignment(assignment.id, assignment.issueId, user.id);
    setAccepting(false);
    if (acceptError) {
      setError(acceptError);
      return;
    }
    load();
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{CATEGORY_LABEL[assignment.category]}</Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{STATUS_SHORT_LABEL[assignment.status as IssueStatus]}</Text>
          </View>
        </View>
        <Text style={styles.summary}>{assignment.issueSummary}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={color.mutedForeground} />
          <Text style={styles.meta}>{assignment.neighborhood} · authorized exact location</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={color.mutedForeground} />
          <Text style={styles.meta}>
            {assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleString()}` : "No due date set"}
          </Text>
        </View>
      </Card>

      {assignment.status === "assigned" ? (
        <Button label={accepting ? "Accepting…" : "Accept assignment"} size="hero" disabled={accepting} onPress={handleAccept} />
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        label="Open in maps"
        variant="secondary"
        onPress={() => router.push({ pathname: "/assignments/[id]/navigate", params: { id: assignment.id } })}
      />

      {/* What To Do SOP Checklist */}
      <Card style={{ gap: spacing[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 18 }}>🛠️</Text>
          <Text style={styles.cardTitle}>Standard Operating Procedure (What To Do)</Text>
        </View>
        <Text style={styles.cardHint}>
          Follow these sequential steps to resolve this {CATEGORY_LABEL[assignment.category]} report:
        </Text>

        <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
          {(SOP_GUIDES[assignment.category] ?? SOP_GUIDES.other).steps.map((st, i) => (
            <View key={i} style={styles.sopStepRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={color.civicGreen} />
              <Text style={styles.sopStepText}>{st}</Text>
            </View>
          ))}
        </View>

        <View style={styles.toolsSection}>
          <Text style={styles.toolsTitle}>Required Tools & PPE:</Text>
          <Text style={styles.toolsList}>
            {(SOP_GUIDES[assignment.category] ?? SOP_GUIDES.other).tools.join(" · ")}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Resolution evidence</Text>
        <Text style={styles.cardHint}>
          {assignment.afterPhotoCaptured
            ? "Evidence submitted — awaiting administrator verification. You cannot mark this resolved yourself."
            : "Capture before/after photos, then submit for verification."}
        </Text>
        <Button
          label="Capture evidence"
          disabled={assignment.status === "assigned"}
          onPress={() => router.push({ pathname: "/assignments/[id]/evidence", params: { id: assignment.id } })}
        />
      </Card>

      <Card tone="muted" style={styles.safetyCard}>
        <Ionicons name="shield-checkmark-outline" size={18} color={color.civicAmber} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.safetyTitle}>Field safety</Text>
          <Text style={styles.safetyText}>
            Wear visibility gear near traffic, do not enter unstable structures, and reschedule if a
            site looks unsafe. The reporter's contact details are never shared with field staff.
          </Text>
        </View>
      </Card>

      {user ? <IssueChat issueId={assignment.issueId} currentUserId={user.id} senderRole="staff" /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    color: color.foreground,
  },
  statusChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: color.civicAmberSoft,
  },
  statusChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.civicAmber,
  },
  summary: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
  },
  meta: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  cardHint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
  safetyCard: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "flex-start",
  },
  safetyTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  safetyText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 18,
  },
  sopStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  sopStepText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: color.foreground,
    flex: 1,
  },
  toolsSection: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  toolsTitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.mutedForeground,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  toolsList: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.foreground,
    lineHeight: 18,
  },
});
