import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "../components/Button";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";
import { color, fontFamily, fontSize, spacing } from "../lib/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pendingCode, setPendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!email.includes("@")) return setError("Enter a valid email address.");
    setError(null);
    setSubmitting(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    setPendingCode(true);
  };

  const handleConfirm = async () => {
    if (code.trim().length === 0) return setError("Enter the verification code.");
    if (newPassword.length < 8) return setError("Password must be at least 8 characters.");
    setError(null);
    setSubmitting(true);
    const { error: confirmError } = await confirmPasswordReset(code.trim(), newPassword);
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError);
      return;
    }
    router.replace("/(tabs)");
  };

  if (pendingCode) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a 6-digit verification code to {email}. Enter the code and your new password below.
        </Text>

        <TextField
          label="Verification code"
          placeholder="123456"
          autoCapitalize="none"
          autoComplete="one-time-code"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
        />

        <TextField
          label="New password"
          placeholder="At least 8 characters"
          isPassword
          autoComplete="new-password"
          value={newPassword}
          onChangeText={setNewPassword}
          hint="At least 8 characters."
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label={submitting ? "Resetting…" : "Reset password and sign in"}
          disabled={submitting || code.trim().length === 0 || newPassword.length < 8}
          onPress={handleConfirm}
        />

        <Button
          label="Try a different email"
          variant="secondary"
          onPress={() => {
            setPendingCode(false);
            setError(null);
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.body}>
        Enter the email on your account and we'll send you a verification code to choose a new password.
      </Text>

      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        label={submitting ? "Sending…" : "Send verification code"}
        disabled={submitting || !email.includes("@")}
        onPress={handleRequest}
      />

      <Button label="Back to sign in" variant="ghost" onPress={() => router.replace("/sign-in")} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
  },
  body: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 22,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
});
