import { Pressable, Text, StyleSheet, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";

import { useTheme } from "../lib/theme-context";
import { radius, fontSize, fontFamily, spacing } from "../lib/theme";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  size?: "default" | "hero";
  haptics?: boolean;
}

export function Button({
  label,
  variant = "primary",
  disabled,
  size = "default",
  haptics = true,
  style,
  onPress,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === "primary"
      ? colors.inverseBackground
      : variant === "danger"
        ? colors.civicRedSoft
        : variant === "ghost"
          ? "transparent"
          : colors.surface;
  const textColor =
    variant === "primary" ? colors.inverseForeground : variant === "danger" ? colors.civicRed : colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={(event) => {
        if (haptics && !disabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(event);
      }}
      style={(state) => [
        styles.base,
        size === "hero" && styles.hero,
        { backgroundColor, opacity: disabled ? 0.4 : state.pressed ? 0.82 : 1 },
        (variant === "secondary" || variant === "danger") && [
          styles.bordered,
          { borderColor: variant === "danger" ? "transparent" : colors.border },
        ],
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <Text
        style={[styles.label, { color: textColor }, size === "hero" && styles.heroLabel]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[5],
  },
  hero: {
    minHeight: 48,
  },
  bordered: {
    borderWidth: 1,
  },
  label: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  heroLabel: {
    fontSize: fontSize.lg,
  },
});
