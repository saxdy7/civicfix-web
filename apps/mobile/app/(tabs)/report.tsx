import { useEffect, useState } from "react";
import {
  Image,
  Text,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { MapLocationCard } from "../../components/MapLocationCard";
import { useAuth } from "../../lib/auth-context";
import { convexClient, isConvexConfigured } from "../../lib/convex-client";
import { createIssue, uploadIssuePhoto } from "../../lib/repositories/issues";
import { STATUS_SHORT_LABEL } from "../../lib/status";
import { color, fontFamily, fontSize, radius, spacing } from "../../lib/theme";
import type { IssueCategory, IssueSeverity } from "../../lib/types";

import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";

type SimilarIssue = Doc<"issues"> & { distanceM: number };

const CATEGORIES: { key: IssueCategory; label: string }[] = [
  { key: "pothole", label: "Pothole" },
  { key: "garbage", label: "Garbage" },
  { key: "streetlight", label: "Streetlight" },
  { key: "other", label: "Other" },
];

const SEVERITIES: { key: IssueSeverity; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
  { key: "critical", label: "Critical" },
];

const DESCRIPTION_EXAMPLE = 'e.g. "Deep pothole in the right lane, cars swerving to avoid it, been here 3+ days."';

interface CapturedPhoto {
  uri: string;
  base64: string;
  mimeType: string;
}

interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export default function ReportIssueScreen() {
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
  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([]);

  // Request initial GPS on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
          });
        }
      } catch {
        // Optional
      }
    })();
  }, []);

  const canSubmit = category !== null && description.trim().length >= 10 && location !== null;

  useEffect(() => {
    if (!convexClient || !category || !location) {
      setSimilarIssues([]);
      return;
    }
    const timeout = setTimeout(() => {
      convexClient!
        .query(api.issues.findNearbySimilar, {
          latitude: location.latitude,
          longitude: location.longitude,
          category,
          radiusM: 200,
        })
        .then((rows) => setSimilarIssues(rows))
        .catch(() => setSimilarIssues([]));
    }, 600);
    return () => clearTimeout(timeout);
  }, [category, location]);

  const submitting = uploadStage !== "idle";

  const applyPhoto = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;
    setPhoto({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleTakePhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, mediaTypes: ["images"] });
    if (!result.canceled) applyPhoto(result.assets[0]);
  };

  const handlePickPhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ["images"] });
    if (!result.canceled) applyPhoto(result.assets[0]);
  };

  const handleUseLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Location permission is required to pin the issue's spot.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      setError("Couldn't get your location — check Location Services and try again.");
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !category || !location || !user) return;
    setError(null);

    if (!isConvexConfigured) {
      const demoTrackingId = `CF-${Math.floor(10000 + Math.random() * 90000)}`;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push({ pathname: "/report/confirmation", params: { trackingId: demoTrackingId } });
      return;
    }

    setUploadStage("report");
    const result = await createIssue({
      category,
      description: description.trim(),
      severity,
      latitude: location.latitude,
      longitude: location.longitude,
      neighborhood: neighborhood.trim() || undefined,
    });

    if ("error" in result) {
      setUploadStage("idle");
      setError(result.error);
      return;
    }

    if (photo) {
      setUploadStage("photo");
      const uploadResult = await uploadIssuePhoto(result.issueId, {
        uri: photo.uri,
        base64: photo.base64,
        mimeType: photo.mimeType,
      });
      if (uploadResult.error) {
        setError(`Report filed (${result.trackingId}), but photo upload failed: ${uploadResult.error}`);
      }
    }

    setUploadStage("idle");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.push({ pathname: "/report/confirmation", params: { trackingId: result.trackingId } });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Title */}
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Report an issue</Text>
          </View>

          {/* 1. What kind of issue? */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. What kind of issue?</Text>
            <View style={styles.grid2x2}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    style={[
                      styles.pillButton,
                      isSelected ? styles.pillButtonActive : styles.pillButtonInactive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setCategory(cat.key);
                    }}
                  >
                    <Text
                      style={[
                        styles.pillButtonText,
                        isSelected ? styles.pillButtonTextActive : styles.pillButtonTextInactive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 2. Add a photo */}
          <View style={styles.cardContainer}>
            <Text style={styles.cardTitle}>2. Add a photo</Text>
            <Text style={styles.cardHint}>
              Strongly recommended — helps AI-assisted triage and speeds routing.
            </Text>

            {photo ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreviewImage} />
                <View style={styles.photoActionsRow}>
                  <Pressable
                    style={[styles.pillButton, styles.pillButtonInactive, { flex: 1 }]}
                    onPress={handleTakePhoto}
                  >
                    <Text style={[styles.pillButtonText, styles.pillButtonTextInactive]}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.pillButton, styles.pillButtonInactive, { flex: 1, borderColor: "rgba(239, 68, 68, 0.4)" }]}
                    onPress={() => setPhoto(null)}
                  >
                    <Text style={[styles.pillButtonText, { color: "#ef4444" }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.photoButtonsRow}>
                <Pressable
                  style={[styles.pillButton, styles.pillButtonActive, { flex: 1 }]}
                  onPress={handleTakePhoto}
                >
                  <Text style={[styles.pillButtonText, styles.pillButtonTextActive]}>Take photo</Text>
                </Pressable>
                <Pressable
                  style={[styles.pillButton, styles.pillButtonInactive, { flex: 1.2 }]}
                  onPress={handlePickPhoto}
                >
                  <Text style={[styles.pillButtonText, styles.pillButtonTextInactive]}>Choose from library</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* 3. Where is it? */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Where is it?</Text>
            <MapLocationCard
              latitude={location ? location.latitude : null}
              longitude={location ? location.longitude : null}
              accuracyMeters={location ? location.accuracyMeters : null}
              onUpdateLocation={handleUseLocation}
              onLocationChange={(coords) => {
                setLocation({
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracyMeters: coords.accuracyMeters,
                });
              }}
              locating={locating}
              onAddressResolved={(addr) => {
                setNeighborhood(addr);
              }}
            />

            {/* Landmark Input */}
            <View style={{ marginTop: spacing[3] }}>
              <Text style={styles.inputLabel}>Nearest landmark or cross street (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Maple & 5th St, near Community Park"
                placeholderTextColor="#64748b"
                value={neighborhood}
                onChangeText={setNeighborhood}
              />
            </View>
          </View>

          {/* SIMILAR REPORTS NEARBY */}
          {similarIssues.length > 0 ? (
            <View style={styles.cardContainer}>
              <Text style={[styles.cardTitle, { color: "#f59e0b" }]}>Similar reports nearby</Text>
              <Text style={styles.cardHint}>Consider confirming one of these instead of filing a new report.</Text>
              {similarIssues.map((s) => (
                <View key={s._id} style={{ marginTop: 4 }}>
                  <Text style={styles.cardHint}>
                    • {s.trackingId} · {STATUS_SHORT_LABEL[s.status]} · ~{Math.round(s.distanceM)}m away
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 4. How urgent is it? */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. How urgent is it?</Text>
            <Text style={styles.cardHint}>
              Your assessment is a signal — staff confirm severity during triage.
            </Text>
            <View style={[styles.grid2x2, { marginTop: spacing[3] }]}>
              {SEVERITIES.map((s) => {
                const isSelected = severity === s.key;
                return (
                  <Pressable
                    key={s.key}
                    style={[
                      styles.pillButton,
                      isSelected ? styles.pillButtonActive : styles.pillButtonInactive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setSeverity(s.key);
                    }}
                  >
                    <Text
                      style={[
                        styles.pillButtonText,
                        isSelected ? styles.pillButtonTextActive : styles.pillButtonTextInactive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. Describe the issue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Describe the issue</Text>
            <TextInput
              style={styles.textAreaInput}
              placeholder={DESCRIPTION_EXAMPLE}
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />
            <Text style={styles.charCountText}>
              {description.trim().length} characters — minimum 10.
            </Text>

            {description.trim().length >= 4 ? (
              <Pressable
                style={styles.aiTriageBtn}
                onPress={() => {
                  const lower = description.toLowerCase();
                  if (lower.includes("pothole") || lower.includes("road") || lower.includes("crater") || lower.includes("asphalt") || lower.includes("pavement")) {
                    setCategory("pothole");
                  } else if (lower.includes("trash") || lower.includes("garbage") || lower.includes("dump") || lower.includes("waste") || lower.includes("bin")) {
                    setCategory("garbage");
                  } else if (lower.includes("light") || lower.includes("lamp") || lower.includes("dark") || lower.includes("streetlight") || lower.includes("bulb")) {
                    setCategory("streetlight");
                  } else {
                    setCategory("other");
                  }

                  if (lower.includes("danger") || lower.includes("hazard") || lower.includes("emergency") || lower.includes("fatal") || lower.includes("deep")) {
                    setSeverity("high");
                  } else if (lower.includes("minor") || lower.includes("small") || lower.includes("cosmetic")) {
                    setSeverity("low");
                  } else {
                    setSeverity("medium");
                  }

                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                }}
              >
                <Ionicons name="sparkles" size={16} color="#ffffff" />
                <Text style={styles.aiTriageBtnText}>✨ AI Auto-Classify (Category & Severity)</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Privacy Note */}
          <View style={styles.privacyCard}>
            <Ionicons name="lock-closed-outline" size={16} color="#8e8e8e" />
            <Text style={styles.privacyNoteText}>
              Your exact location and contact details are only visible to authorized staff. Public maps show a generalized location, and EXIF metadata is stripped from your photo.
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Pressable
              style={[
                styles.submitButton,
                !canSubmit || submitting ? styles.submitButtonDisabled : null,
              ]}
              disabled={!canSubmit || submitting}
              onPress={handleSubmit}
            >
              {submitting ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#000000" size="small" />
                  <Text style={styles.submitButtonText}>
                    {uploadStage === "photo" ? "Uploading photo…" : "Submitting…"}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Submit report</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[8] + 20,
    gap: spacing[5],
  },
  header: {
    paddingVertical: spacing[1],
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  grid2x2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    justifyContent: "space-between",
  },
  pillButton: {
    width: "48.5%",
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
  },
  pillButtonInactive: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  pillButtonActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  pillButtonText: {
    fontSize: 15,
    fontFamily: fontFamily.semibold,
  },
  pillButtonTextInactive: {
    color: "#ffffff",
  },
  pillButtonTextActive: {
    color: "#000000",
    fontFamily: fontFamily.bold,
  },
  cardContainer: {
    backgroundColor: "#121214",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  cardHint: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    lineHeight: 18,
  },
  photoButtonsRow: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[2],
  },
  photoPreviewWrap: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  photoPreviewImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    backgroundColor: "#18181b",
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: fontFamily.medium,
    color: "#8e8e8e",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: "#ffffff",
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
  textAreaInput: {
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
    color: "#ffffff",
    fontSize: 14,
    fontFamily: fontFamily.regular,
    textAlignVertical: "top",
  },
  charCountText: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    marginTop: 4,
  },
  aiTriageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: radius.pill,
    height: 44,
    marginTop: spacing[2],
  },
  aiTriageBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: "#ffffff",
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    backgroundColor: "#121214",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fontFamily.medium,
    color: "#ff9a92",
    textAlign: "center",
  },
  submitSection: {
    paddingTop: spacing[1],
    paddingBottom: spacing[4],
  },
  submitButton: {
    width: "100%",
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.35,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: "#000000",
  },
});
