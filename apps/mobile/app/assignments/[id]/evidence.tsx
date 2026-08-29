import { useState } from "react";
import { Image, Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { TextField } from "../../../components/TextField";
import { useAuth } from "../../../lib/auth-context";
import { fetchAssignmentById, submitResolutionEvidence } from "../../../lib/repositories/assignments";
import { color, fontSize, spacing } from "../../../lib/theme";

interface CapturedPhoto {
  uri: string;
  base64: string;
  contentType: string;
  extension: string;
}

async function capturePhoto(): Promise<CapturedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, mediaTypes: ["images"] });
  const asset = result.assets?.[0];
  if (result.canceled || !asset?.base64) return null;
  return {
    uri: asset.uri,
    base64: asset.base64,
    contentType: asset.mimeType ?? "image/jpeg",
    extension: (asset.uri.split(".").pop() || "jpg").toLowerCase(),
  };
}

export default function ResolutionEvidence() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [before, setBefore] = useState<CapturedPhoto | null>(null);
  const [after, setAfter] = useState<CapturedPhoto | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = before !== null && after !== null;

  const handleCapture = async (which: "before" | "after") => {
    setError(null);
    const photo = await capturePhoto();
    if (!photo) {
      setError("Camera permission is required to capture evidence.");
      return;
    }
    if (which === "before") setBefore(photo);
    else setAfter(photo);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !before || !after || !user || !id) return;
    setSubmitting(true);
    setError(null);

    const assignment = await fetchAssignmentById(id, user.id);
    if (!assignment) {
      setError("Could not find this assignment.");
      setSubmitting(false);
      return;
    }

    const { error: submitError } = await submitResolutionEvidence({
      assignmentId: id,
      issueId: assignment.issueId,
      workerId: user.id,
      before,
      after,
      note,
    });

    setSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.submittedTitle}>Submitted for verification</Text>
          <Text style={styles.hint}>
            An administrator will review your evidence and mark this issue resolved or reopen it
            with feedback.
          </Text>
          <Button label="Back to assignment" onPress={() => router.back()} style={{ width: "100%" }} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Card>
        <Text style={styles.cardTitle}>Before photo</Text>
        {before ? <Image source={{ uri: before.uri }} style={styles.photoPreview} /> : null}
        <Button
          label={before ? "Retake before photo" : "Capture before photo"}
          variant="secondary"
          onPress={() => handleCapture("before")}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>After photo</Text>
        {after ? <Image source={{ uri: after.uri }} style={styles.photoPreview} /> : null}
        <Button
          label={after ? "Retake after photo" : "Capture after photo"}
          variant="secondary"
          onPress={() => handleCapture("after")}
        />
      </Card>

      <TextField
        label="Resolution note (optional)"
        placeholder="What was done to fix the issue?"
        multiline
        numberOfLines={3}
        value={note}
        onChangeText={setNote}
        style={{ minHeight: 80, textAlignVertical: "top", paddingTop: spacing[3] }}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        label={submitting ? "Submitting…" : "Submit for verification"}
        disabled={!canSubmit || submitting}
        onPress={handleSubmit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  photoPreview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
  },
  checkmark: {
    fontSize: 48,
    color: color.civicGreen,
  },
  submittedTitle: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: color.foreground,
  },
  hint: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    textAlign: "center",
  },
  errorText: {
    fontSize: fontSize.sm,
    color: color.civicRed,
  },
});
