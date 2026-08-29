import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { color, fontFamily, fontSize, spacing } from "../lib/theme";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <View style={styles.wrapper} accessibilityRole="text">
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={28} color={color.mutedForeground} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={{ marginTop: spacing[2], width: "100%" }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing[6],
    alignItems: "center",
    gap: spacing[2],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[1],
  },
  title: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  description: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
});
