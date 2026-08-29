import { View, StyleSheet, type ViewProps } from "react-native";

import { color, radius, spacing } from "../lib/theme";

interface CardProps extends ViewProps {
  tone?: "default" | "muted" | "inverse";
  /** Removes padding — for photo/media that should fill the card edge-to-edge. */
  flush?: boolean;
}

export function Card({ style, tone = "default", flush = false, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        tone === "muted" && styles.muted,
        tone === "inverse" && styles.inverse,
        flush && styles.flush,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing[4],
    gap: spacing[2],
    overflow: "hidden",
  },
  muted: {
    backgroundColor: color.surfaceMuted,
    borderColor: "transparent",
  },
  inverse: {
    backgroundColor: color.inverseBackground,
    borderColor: "transparent",
  },
  flush: {
    padding: 0,
    gap: 0,
  },
});
