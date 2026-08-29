// Mirrors the design tokens in spec/DESIGN.md and apps/web/src/app/globals.css
// exactly, so the mobile app reads as the same product as the website: dark,
// monochrome, with accent color reserved for status/category signal only —
// never for page chrome or primary actions.
import { Platform } from "react-native";

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

export const radius = {
  control: 10,
  pill: 999,
  card: 20,
  hero: 28,
  modal: 16,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

// Inter carries all UI/body copy (loaded via @expo-google-fonts/inter — see
// app/_layout.tsx's useFonts gate). The web app's dot-matrix display face
// (BubbledotICG-FinePos) is a licensed CDN webfont with no distributable
// file to bundle into a native app; spec/DESIGN.md's own documented
// fallback — "Geist Pixel Circle, monospace" — is honored here via the
// platform monospace face for display headings, rather than guessing at a
// substitute we can't verify the license for.
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  display: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
} as const;

export const color = {
  background: "#000000",
  backgroundMuted: "#0a0a0b",
  surface: "#111113",
  surfaceMuted: "#1a1a1d",
  surfaceRaised: "#202024",

  foreground: "#ffffff",
  mutedForeground: "#8e8e8e",
  dimForeground: "#5f5f63",

  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.24)",

  // The light side — primary buttons, active states, anything that must
  // pop out of the dark ground.
  inverseBackground: "#ffffff",
  inverseForeground: "#0a0a0a",
  pillDark: "#28282a",

  // Accent tokens: status pills and category signal only.
  civicBlue: "#8fb4ff",
  civicBlueSoft: "rgba(94,138,255,0.16)",
  civicBlueContrast: "#0a0a0a",
  civicGreen: "#6ee7a5",
  civicGreenSoft: "rgba(52,211,153,0.16)",
  civicAmber: "#f5c069",
  civicAmberSoft: "rgba(245,158,11,0.16)",
  civicRed: "#ff9a92",
  civicRedSoft: "rgba(248,113,113,0.16)",

  // Legacy aliases kept so existing call sites don't need a mechanical
  // rename — repointed at the dark-theme equivalents rather than the old
  // light-theme grays.
  slate100: "#1a1a1d",
  slate600: "#8e8e8e",
} as const;
