import { Text, TextInput, View, StyleSheet, type TextInputProps } from "react-native";

import { color, fontSize, radius, spacing } from "../lib/theme";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={color.slate600}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[1],
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: color.foreground,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing[3],
    fontSize: fontSize.md,
    color: color.foreground,
    backgroundColor: color.surface,
  },
  inputError: {
    borderColor: color.civicRed,
  },
  error: {
    fontSize: fontSize.xs,
    color: color.civicRed,
  },
});
