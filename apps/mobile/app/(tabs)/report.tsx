import { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";
import { CATEGORY_LABEL } from "../../lib/status";
import { color, fontSize, spacing } from "../../lib/theme";
import type { IssueCategory } from "../../lib/types";

const CATEGORIES: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];

export default function ReportIssue() {
  const router = useRouter();
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [description, setDescription] = useState("");
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = category !== null && description.trim().length >= 10 && locationCaptured;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const trackingId = `CF-${Math.floor(10000 + Math.random() * 89999)}`;
    setTimeout(() => {
      setSubmitting(false);
      router.push({ pathname: "/report/confirmation", params: { trackingId } });
    }, 400);
  };

  return (
    <ScreenContainer>
      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            label={CATEGORY_LABEL[cat]}
            variant={category === cat ? "primary" : "secondary"}
            onPress={() => setCategory(cat)}
            style={styles.categoryButton}
          />
        ))}
      </View>

      <Card>
        <Text style={styles.cardTitle}>Photo</Text>
        <Text style={styles.cardHint}>A photo helps AI-assisted triage and speeds routing.</Text>
        <Button
          label={photoCaptured ? "Photo attached ✓" : "Add photo"}
          variant="secondary"
          onPress={() => setPhotoCaptured(true)}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Location</Text>
        <Text style={styles.cardHint}>
          {locationCaptured ? "GPS location captured." : "Drop a pin at the issue location."}
        </Text>
        <Button
          label={locationCaptured ? "Location captured ✓" : "Use current location"}
          variant="secondary"
          onPress={() => setLocationCaptured(true)}
        />
      </Card>

      <TextField
        label="Description"
        placeholder="What's wrong, and how urgent is it?"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        style={{ minHeight: 96, textAlignVertical: "top", paddingTop: spacing[3] }}
      />

      <Text style={styles.privacyNote}>
        Your exact location and contact details are only visible to authorized staff. Public
        maps show a generalized location.
      </Text>

      <Button
        label={submitting ? "Submitting..." : "Submit report"}
        disabled={!canSubmit || submitting}
        onPress={handleSubmit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: color.foreground,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  categoryButton: {
    minWidth: "47%",
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  cardHint: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
  privacyNote: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
  },
});
