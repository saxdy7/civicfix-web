import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../lib/theme-context";
import { fontFamily, fontSize, spacing } from "../lib/theme";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper} accessibilityRole="text">
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={icon} size={28} color={colors.mutedForeground} />
        </View>
      ) : null}
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[1],
  },
  title: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  description: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: "center",
    lineHeight: 20,
  },
});
