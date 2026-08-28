import { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { TextField } from "../../../components/TextField";
import { color, fontSize, spacing } from "../../../lib/theme";

export default function ResolutionEvidence() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [beforeCaptured, setBeforeCaptured] = useState(false);
  const [afterCaptured, setAfterCaptured] = useState(false);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = beforeCaptured && afterCaptured;

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
        <Button
          label={beforeCaptured ? "Captured ✓" : "Capture before photo"}
          variant="secondary"
          onPress={() => setBeforeCaptured(true)}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>After photo</Text>
        <Button
          label={afterCaptured ? "Captured ✓" : "Capture after photo"}
          variant="secondary"
          onPress={() => setAfterCaptured(true)}
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

      <Button
        label="Submit for verification"
        disabled={!canSubmit}
        onPress={() => setSubmitted(true)}
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
});
