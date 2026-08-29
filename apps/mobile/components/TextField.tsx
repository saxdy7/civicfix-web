import { useState } from "react";
import { Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  /** Adds a show/hide toggle instead of a plain secureTextEntry field. */
  isPassword?: boolean;
}

export function TextField({ label, error, hint, isPassword, style, secureTextEntry, ...props }: TextFieldProps) {
  const [reveal, setReveal] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, error && styles.inputError, isPassword && styles.inputWithIcon, style]}
          placeholderTextColor={color.dimForeground}
          secureTextEntry={isPassword ? !reveal : secureTextEntry}
          {...props}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reveal ? "Hide password" : "Show password"}
            onPress={() => setReveal((v) => !v)}
            style={styles.iconButton}
            hitSlop={8}
          >
            <Ionicons name={reveal ? "eye-off-outline" : "eye-outline"} size={20} color={color.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[1],
  },
  label: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  inputRow: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing[3],
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: color.foreground,
    backgroundColor: color.surface,
  },
  inputWithIcon: {
    paddingRight: spacing[6],
  },
  iconButton: {
    position: "absolute",
    right: spacing[3],
    padding: spacing[1],
  },
  inputError: {
    borderColor: color.civicRed,
  },
  error: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.civicRed,
  },
  hint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
});
