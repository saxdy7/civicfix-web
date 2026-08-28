import { Pressable, Text, StyleSheet, type PressableProps } from "react-native";

import { color, radius, fontSize, spacing } from "../lib/theme";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

export function Button({ label, variant = "primary", disabled, style, ...props }: ButtonProps) {
  const bg =
    variant === "primary" ? color.civicBlue : variant === "danger" ? color.civicRed : color.surface;
  const textColor = variant === "secondary" ? color.foreground : color.civicBlueContrast;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.base,
        { backgroundColor: bg, opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1 },
        variant === "secondary" && styles.secondaryBorder,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: color.border,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
