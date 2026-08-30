import { useEffect, useState } from "react";
import { Linking, Platform, Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Button } from "../../../components/Button";
import { MapLocationCard } from "../../../components/MapLocationCard";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useAuth } from "../../../lib/auth-context";
import { fetchAssignmentById } from "../../../lib/repositories/assignments";
import { color, fontFamily, fontSize, spacing } from "../../../lib/theme";
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
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${assignment.latitude},${assignment.longitude}`;
      await Linking.openURL(fallback).catch(() => setError("Couldn't open a maps app on this device."));
      return;
    }
    await Linking.openURL(url).catch(() => setError("Couldn't open a maps app on this device."));
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <View style={styles.center}>
        <Text style={styles.title}>📍 Navigation & Site Map</Text>
        <Text style={styles.hint}>
          Interactive GPS location and navigation route for {assignment?.neighborhood ?? "assigned site"}.
        </Text>

        <MapLocationCard
          latitude={assignment ? assignment.latitude : null}
          longitude={assignment ? assignment.longitude : null}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label="Open in Navigation App (Google/Apple Maps) ↗"
          size="hero"
          onPress={openInMaps}
          disabled={!assignment}
          style={{ width: "100%", marginTop: spacing[2] }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    textAlign: "center",
  },
  hint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    textAlign: "center",
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
    textAlign: "center",
  },
});
