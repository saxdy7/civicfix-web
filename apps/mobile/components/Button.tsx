import { Pressable, Text, StyleSheet, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";

import { color, radius, fontSize, fontFamily, spacing } from "../lib/theme";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  /** Hero-sized 48px touch target for the most important action on a screen. */
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
  // Primary is white-fill/black-text — never an accent color. Accent colors
  // are reserved for status/category signal only (spec/DESIGN.md §1).
  const backgroundColor =
    variant === "primary"
      ? color.inverseBackground
      : variant === "danger"
        ? color.civicRedSoft
        : variant === "ghost"
          ? "transparent"
          : color.surface;
  const textColor =
    variant === "primary" ? color.inverseForeground : variant === "danger" ? color.civicRed : color.foreground;

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
        (variant === "secondary" || variant === "danger") && [styles.bordered, variant === "danger" && { borderColor: "transparent" }],
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <Text style={[styles.label, { color: textColor }, size === "hero" && styles.heroLabel]}>{label}</Text>
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
    borderColor: color.border,
  },
  label: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  heroLabel: {
    fontSize: fontSize.lg,
  },
});
