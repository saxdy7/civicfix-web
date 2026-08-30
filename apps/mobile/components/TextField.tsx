import { useState } from "react";
import { Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../lib/theme-context";
import { fontFamily, fontSize, radius, spacing } from "../lib/theme";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
}

export function TextField({ label, error, hint, isPassword, style, secureTextEntry, ...props }: TextFieldProps) {
  const { colors } = useTheme();
  const [reveal, setReveal] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.surface,
            },
            error && { borderColor: colors.civicRed },
            isPassword && styles.inputWithIcon,
            style,
          ]}
          placeholderTextColor={colors.dimForeground}
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
            <Ionicons name={reveal ? "eye-off-outline" : "eye-outline"} size={20} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.civicRed }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>
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
  },
  inputRow: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing[3],
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
  },
  inputWithIcon: {
    paddingRight: spacing[6],
  },
  iconButton: {
    position: "absolute",
    right: spacing[3],
    padding: spacing[1],
  },
  error: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  hint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});
