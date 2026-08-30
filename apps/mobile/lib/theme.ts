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

export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  display: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
} as const;

export interface ColorPalette {
  background: string;
  backgroundMuted: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;

  foreground: string;
  mutedForeground: string;
  dimForeground: string;

  border: string;
  borderStrong: string;

  inverseBackground: string;
  inverseForeground: string;
  pillDark: string;
  pillActive: string;
  pillActiveText: string;

  civicBlue: string;
  civicBlueSoft: string;
  civicBlueContrast: string;
  civicGreen: string;
  civicGreenSoft: string;
  civicAmber: string;
  civicAmberSoft: string;
  civicRed: string;
  civicRedSoft: string;

  slate100: string;
  slate600: string;
}

export const lightColors: ColorPalette = {
  background: "#f8fafc",
  backgroundMuted: "#ffffff",
  surface: "#ffffff",
  surfaceMuted: "#f1f5f9",
  surfaceRaised: "#e2e8f0",

  foreground: "#0f172a",
  mutedForeground: "#64748b",
  dimForeground: "#94a3b8",

  border: "#e2e8f0",
  borderStrong: "#cbd5e1",

  inverseBackground: "#0f172a",
  inverseForeground: "#ffffff",
  pillDark: "#f1f5f9",
  pillActive: "#0f172a",
  pillActiveText: "#ffffff",

  civicBlue: "#2563eb",
  civicBlueSoft: "rgba(37, 99, 235, 0.1)",
  civicBlueContrast: "#ffffff",
  civicGreen: "#16a34a",
  civicGreenSoft: "rgba(22, 163, 74, 0.12)",
  civicAmber: "#d97706",
  civicAmberSoft: "rgba(217, 119, 6, 0.12)",
  civicRed: "#dc2626",
  civicRedSoft: "rgba(220, 38, 38, 0.12)",

  slate100: "#f1f5f9",
  slate600: "#64748b",
};

export const darkColors: ColorPalette = {
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

  inverseBackground: "#ffffff",
  inverseForeground: "#0a0a0a",
  pillDark: "#28282a",
  pillActive: "#ffffff",
  pillActiveText: "#000000",

  civicBlue: "#8fb4ff",
  civicBlueSoft: "rgba(94,138,255,0.16)",
  civicBlueContrast: "#0a0a0a",
  civicGreen: "#6ee7a5",
  civicGreenSoft: "rgba(52,211,153,0.16)",
  civicAmber: "#f5c069",
  civicAmberSoft: "rgba(245,158,11,0.16)",
  civicRed: "#ff9a92",
  civicRedSoft: "rgba(248,113,113,0.16)",

  slate100: "#1a1a1d",
  slate600: "#8e8e8e",
};

// Default is White / Light Theme per user request!
export const color: ColorPalette = lightColors;

export type ThemeType = "light" | "dark";
