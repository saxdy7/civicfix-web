import { useEffect, useState } from "react";
import { Linking, Platform, Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Button } from "../../../components/Button";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useAuth } from "../../../lib/auth-context";
import { fetchAssignmentById } from "../../../lib/repositories/assignments";
import { color, fontSize, spacing } from "../../../lib/theme";
import type { Assignment } from "../../../lib/types";

function mapsUrl(assignment: Assignment): string {
  const { latitude, longitude } = assignment;
  if (Platform.OS === "ios") {
    return `maps://?daddr=${latitude},${longitude}`;
  }
  if (Platform.OS === "android") {
    return `geo:0,0?q=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export default function NavigateHandoff() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    fetchAssignmentById(id, user.id).then(setAssignment);
  }, [id, user]);

  const openInMaps = async () => {
    if (!assignment) return;
    setError(null);
    const url = mapsUrl(assignment);
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      // Fall back to the universal web URL if the native maps scheme isn't
      // registered on this device (e.g. no Google/Apple Maps installed).
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${assignment.latitude},${assignment.longitude}`;
      await Linking.openURL(fallback).catch(() => setError("Couldn't open a maps app on this device."));
      return;
    }
    await Linking.openURL(url).catch(() => setError("Couldn't open a maps app on this device."));
  };

  return (
    <ScreenContainer scroll={false} edges={["left", "right"]}>
      <View style={styles.center}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>
            A native map preview isn't wired in yet — hand off to your device's maps app instead.
          </Text>
        </View>
        <Text style={styles.title}>{assignment?.neighborhood ?? "Assignment location"}</Text>
        <Text style={styles.hint}>
          Hand off to your device's default navigation app to get turn-by-turn directions.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          label="Open in Maps app"
          onPress={openInMaps}
          disabled={!assignment}
          style={{ width: "100%" }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    gap: spacing[4],
  },
  mapPlaceholder: {
    height: 220,
    backgroundColor: color.slate100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  mapPlaceholderText: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    paddingHorizontal: spacing[4],
    textAlign: "center",
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: color.foreground,
    textAlign: "center",
  },
  hint: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    textAlign: "center",
  },
  errorText: {
    fontSize: fontSize.sm,
    color: color.civicRed,
    textAlign: "center",
  },
});
