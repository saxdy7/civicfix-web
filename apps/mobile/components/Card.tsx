import { View, StyleSheet, type ViewProps } from "react-native";

import { useTheme } from "../lib/theme-context";
import { radius, spacing } from "../lib/theme";

interface CardProps extends ViewProps {
  tone?: "default" | "muted" | "inverse";
  flush?: boolean;
}

export function Card({ style, tone = "default", flush = false, ...props }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            tone === "muted"
              ? colors.surfaceMuted
              : tone === "inverse"
                ? colors.inverseBackground
                : colors.surface,
          borderColor: tone === "default" ? colors.border : "transparent",
        },
        flush && styles.flush,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[2],
    overflow: "hidden",
  },
  flush: {
    padding: 0,
    gap: 0,
  },
});
