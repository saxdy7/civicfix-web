import { useEffect, useState } from "react";
import { Linking, Text, View, StyleSheet, type DimensionValue } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { fetchPlatformStats, type PlatformStats } from "../lib/repositories/stats";
import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";
import { ScreenContainer } from "../components/ScreenContainer";

const STEPS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "camera-outline", label: "Report" },
  { icon: "eye-outline", label: "Review" },
  { icon: "person-outline", label: "Assigned" },
  { icon: "checkmark-circle-outline", label: "Resolved" },
];

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MapPreview() {
  // A map-inspired decorative visual, not a live map — a native MapLibre
  // module isn't wired into the mobile app in this pass (see report notes).
  return (
    <View style={styles.mapPreview}>
      <View style={styles.mapGrid}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.mapGridLine, { top: `${(i + 1) * 16}%` }]} />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.mapGridLineV, { left: `${(i + 1) * 20}%` }]} />
        ))}
      </View>
      {(
        [
          { top: "30%", left: "25%", tone: color.civicBlue },
          { top: "55%", left: "62%", tone: color.civicAmber },
          { top: "70%", left: "35%", tone: color.civicGreen },
        ] satisfies { top: DimensionValue; left: DimensionValue; tone: string }[]
      ).map((pin, i) => (
        <View key={i} style={[styles.mapPin, { top: pin.top, left: pin.left, backgroundColor: pin.tone }]} />
      ))}
      <View style={styles.mapCaption}>
        <Ionicons name="location" size={14} color={color.foreground} />
        <Text style={styles.mapCaptionText}>Live issues near you</Text>
      </View>
    </View>
  );
}

export default function Landing() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    fetchPlatformStats().then(setStats);
  }, []);

  return (
    <>
      <ScreenContainer>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="location" size={18} color={color.inverseForeground} />
            </View>
            <Text style={styles.brandName}>CivicFix</Text>
          </View>

          <Text style={styles.headline}>Report civic problems.{"\n"}Track real action.</Text>
          <Text style={styles.subhead}>
            A photo and a pin turn into a traceable resolution — triage, routing, field work, and a
            verified public result.
          </Text>

          <Button label="Report an issue" size="hero" onPress={() => router.push({ pathname: "/sign-in", params: { mode: "sign-up" } })} />
          <Button label="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
        </View>

        {/* Live impact */}
        <Card tone="muted">
          <Text style={styles.sectionLabel}>{stats?.isDemo ? "Demo values" : "Live impact"}</Text>
          <View style={styles.statsRow}>
            <StatTile value={stats ? `${stats.resolved}` : "—"} label="Resolved" />
            <StatTile
              value={stats?.avgResponseHours != null ? `${stats.avgResponseHours.toFixed(0)}h` : "—"}
              label="Avg. response"
            />
            <StatTile value={stats ? `${stats.confirmations}` : "—"} label="Confirmations" />
          </View>
        </Card>

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.stepsRow}>
            {STEPS.map((step, i) => (
              <View key={step.label} style={styles.stepItem}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={step.icon} size={20} color={color.foreground} />
                </View>
                <Text style={styles.stepLabel}>{step.label}</Text>
                {i < STEPS.length - 1 ? <View style={styles.stepConnector} /> : null}
              </View>
            ))}
          </View>
        </View>

        {/* Map preview */}
        <View style={styles.section}>
          <MapPreview />
        </View>

        {/* Trust */}
        <Card tone="muted" style={styles.trustCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={color.civicGreen} />
          <Text style={styles.trustText}>
            Your exact location and contact details are only visible to authorized staff. Public
            maps show a generalized area.
          </Text>
        </Card>

        {/* Footer links */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            New here?{" "}
            <Text
              style={styles.footerLink}
              onPress={() => router.push({ pathname: "/sign-in", params: { mode: "sign-up" } })}
            >
              Create an account
            </Text>
          </Text>
          <View style={styles.legalRow}>
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL("https://civicfix-web.vercel.app/accessibility")}
            >
              Accessibility
            </Text>
            <Text style={styles.legalDot}>·</Text>
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL("https://civicfix-web.vercel.app/accessibility")}
            >
              Privacy
            </Text>
          </View>
        </View>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.inverseBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    color: color.foreground,
  },
  headline: {
    fontSize: fontSize.xxxl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    letterSpacing: -1,
    lineHeight: 46,
  },
  subhead: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statTile: {
    alignItems: "flex-start",
    gap: 2,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  section: {
    gap: spacing[3],
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing[1],
  },
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: color.mutedForeground,
    textAlign: "center",
  },
  stepConnector: {
    position: "absolute",
    top: 22,
    left: "60%",
    width: "80%",
    height: 1,
    backgroundColor: color.border,
  },
  mapPreview: {
    height: 160,
    borderRadius: radius.card,
    backgroundColor: color.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  mapGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: color.border,
  },
  mapGridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: color.border,
  },
  mapPin: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: color.background,
  },
  mapCaption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    margin: spacing[3],
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  mapCaptionText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: color.foreground,
  },
  trustCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  trustText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 20,
  },
  footer: {
    alignItems: "center",
    gap: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  footerText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  footerLink: {
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  legalLink: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.dimForeground,
  },
  legalDot: {
    fontSize: fontSize.xs,
    color: color.dimForeground,
  },
});
