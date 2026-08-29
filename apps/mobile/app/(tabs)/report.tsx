import { useState } from "react";
import { Image, Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";
import { useAuth } from "../../lib/auth-context";
import { createIssue, uploadIssuePhoto } from "../../lib/repositories/issues";
import { CATEGORY_LABEL } from "../../lib/status";
import { isSupabaseConfigured } from "../../lib/supabase";
import { color, fontFamily, fontSize, radius, spacing } from "../../lib/theme";
import type { IssueCategory, IssueSeverity } from "../../lib/types";

const CATEGORIES: { key: IssueCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "pothole", icon: "warning-outline" },
  { key: "garbage", icon: "trash-outline" },
  { key: "streetlight", icon: "bulb-outline" },
  { key: "other", icon: "ellipsis-horizontal-circle-outline" },
];
const SEVERITIES: { key: IssueSeverity; label: string; tone: string }[] = [
  { key: "low", label: "Low", tone: color.mutedForeground },
  { key: "medium", label: "Medium", tone: color.civicBlue },
  { key: "high", label: "High", tone: color.civicAmber },
  { key: "critical", label: "Critical", tone: color.civicRed },
];
const DESCRIPTION_EXAMPLE = 'e.g. "Deep pothole in the right lane, cars swerving to avoid it, been here 3+ days."';

interface CapturedPhoto {
  uri: string;
  base64: string;
  mimeType: string;
  extension: string;
}

interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export default function ReportIssue() {
  const router = useRouter();
  const { user } = useAuth();

  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [description, setDescription] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<"idle" | "photo" | "report">("idle");

  const canSubmit = category !== null && description.trim().length >= 10 && location !== null;
  const submitting = uploadStage !== "idle";

  const applyPhoto = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;
    setPhoto({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? "image/jpeg",
      extension: (asset.uri.split(".").pop() || "jpg").toLowerCase(),
    });
  };

  const handleTakePhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is required to take a photo. You can still submit without one.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, mediaTypes: ["images"] });
    if (!result.canceled) applyPhoto(result.assets[0]);
  };

  const handlePickPhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ["images"] });
    if (!result.canceled) applyPhoto(result.assets[0]);
  };

  const handleUseLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Location permission is required to pin the issue's exact spot.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      setError("Couldn't get your current location — check that Location Services are on, then try again.");
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !category || !location || !user) return;
    setError(null);

    if (!isSupabaseConfigured) {
      setError("Reporting isn't available in demo mode — Supabase isn't configured.");
      return;
    }

    let storageKey: string | null = null;
    let mimeType: string | null = null;
    let checksum: string | null = null;

    if (photo) {
      setUploadStage("photo");
      const uploadResult = await uploadIssuePhoto(user.id, {
        base64: photo.base64,
        contentType: photo.mimeType,
        extension: photo.extension,
      });
      if ("error" in uploadResult) {
        setError(`Photo upload failed: ${uploadResult.error}`);
        setUploadStage("idle");
        return;
      }
      storageKey = uploadResult.storageKey;
      mimeType = photo.mimeType;
      checksum = uploadResult.checksum;
    }

    setUploadStage("report");
    const result = await createIssue({
      category,
      description: description.trim(),
      severity,
      latitude: location.latitude,
      longitude: location.longitude,
      neighborhood: neighborhood.trim() || undefined,
      storageKey,
      mimeType,
      checksum,
    });

    setUploadStage("idle");

    if ("error" in result) {
      setError(result.error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.push({ pathname: "/report/confirmation", params: { trackingId: result.trackingId } });
  };

  return (
    <ScreenContainer>
      <Text style={styles.sectionTitle}>1. What kind of issue?</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <View key={cat.key} style={styles.categoryButton}>
              <Button
                label={CATEGORY_LABEL[cat.key]}
                variant={active ? "primary" : "secondary"}
                onPress={() => setCategory(cat.key)}
                accessibilityState={{ selected: active }}
              />
            </View>
          );
        })}
      </View>

      <Card>
        <Text style={styles.cardTitle}>2. Add a photo</Text>
        <Text style={styles.cardHint}>Strongly recommended — helps AI-assisted triage and speeds routing.</Text>
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            <View style={styles.photoActions}>
              <Button label="Retake" variant="secondary" onPress={handleTakePhoto} style={{ flex: 1 }} />
              <Button label="Remove" variant="ghost" onPress={() => setPhoto(null)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={styles.photoActions}>
            <Button label="Take photo" onPress={handleTakePhoto} style={{ flex: 1 }} />
            <Button label="Choose from library" variant="secondary" onPress={handlePickPhoto} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>3. Where is it?</Text>
        {location ? (
          <View style={styles.locationRow}>
            <Ionicons name="checkmark-circle" size={16} color={color.civicGreen} />
            <Text style={styles.cardHint}>
              Captured{location.accuracyMeters ? ` · ±${Math.round(location.accuracyMeters)}m accuracy` : ""}
            </Text>
          </View>
        ) : (
          <Text style={styles.cardHint}>Use your current GPS location.</Text>
        )}
        <Button
          label={locating ? "Locating…" : location ? "Update location" : "Use current location"}
          variant="secondary"
          disabled={locating}
          onPress={handleUseLocation}
        />
      </Card>

      <TextField
        label="Nearest landmark or cross street (optional)"
        placeholder="e.g. Maple & 5th"
        value={neighborhood}
        onChangeText={setNeighborhood}
      />

      <Text style={styles.sectionTitle}>4. How urgent is it?</Text>
      <Text style={styles.cardHint}>Your assessment is a signal — staff confirm severity during triage.</Text>
      <View style={styles.severityRow}>
        {SEVERITIES.map((s) => {
          const active = severity === s.key;
          return (
            <View key={s.key} style={{ flex: 1 }}>
              <Button
                label={s.label}
                variant={active ? "primary" : "secondary"}
                onPress={() => setSeverity(s.key)}
                accessibilityState={{ selected: active }}
              />
            </View>
          );
        })}
      </View>

      <TextField
        label="5. Describe the issue"
        placeholder={DESCRIPTION_EXAMPLE}
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        style={{ minHeight: 96, textAlignVertical: "top", paddingTop: spacing[3] }}
        hint={`${description.trim().length} characters — minimum 10.`}
      />

      <Card tone="muted" style={styles.privacyCard}>
        <Ionicons name="lock-closed-outline" size={16} color={color.mutedForeground} />
        <Text style={styles.privacyNote}>
          Your exact location and contact details are only visible to authorized staff. Public maps
          show a generalized location, and EXIF metadata is stripped from your photo.
        </Text>
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        label={uploadStage === "photo" ? "Uploading photo…" : uploadStage === "report" ? "Submitting…" : "Submit report"}
        size="hero"
        disabled={!canSubmit || submitting}
        onPress={handleSubmit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  categoryButton: {
    minWidth: "47%",
    flexGrow: 1,
  },
  severityRow: {
    flexDirection: "row",
    gap: spacing[2],
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
  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: radius.card,
    marginBottom: spacing[2],
  },
  photoActions: {
    flexDirection: "row",
    gap: spacing[2],
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
  },
  privacyCard: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "flex-start",
  },
  privacyNote: {
    flex: 1,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 18,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
});
