import { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";
import { color, fontFamily, fontSize, spacing } from "../lib/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.includes("@")) return setError("Enter a valid email address.");
    setError(null);
    setSubmitting(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <Card style={{ alignItems: "center", gap: spacing[2], marginTop: spacing[6] }}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            If an account exists for {email}, we sent a link to reset your password.
          </Text>
        </Card>
        <Button label="Back to sign in" onPress={() => router.replace("/sign-in")} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.body}>
        Enter the email on your account and we'll send you a link to choose a new password.
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
        label={submitting ? "Sending…" : "Send reset link"}
        disabled={submitting || !email.includes("@")}
        onPress={handleSubmit}
      />
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
