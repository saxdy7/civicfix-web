import { View, StyleSheet, type ViewProps } from "react-native";

import { color, radius, spacing } from "../lib/theme";

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing[4],
    gap: spacing[2],
  },
});
