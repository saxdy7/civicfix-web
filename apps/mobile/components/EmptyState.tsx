import { Text, View, StyleSheet } from "react-native";

import { color, fontSize, spacing } from "../lib/theme";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing[5],
    alignItems: "center",
    gap: spacing[1],
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  description: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
    textAlign: "center",
  },
});
