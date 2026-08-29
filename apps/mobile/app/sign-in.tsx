import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";
import { isSupabaseConfigured } from "../lib/supabase";
import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";

export default function SignIn() {
  const router = useRouter();
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const { user, signIn, signUp, continueAsDemo } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(initialMode === "sign-up" ? "sign-up" : "sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Redirect href="/(tabs)" />;

  const canSubmit = email.includes("@") && password.length >= 8 && (mode === "sign-in" || name.trim().length >= 2);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);

    if (mode === "sign-in") {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) setError(signInError);
    } else {
      const { error: signUpError, needsConfirmation } = await signUp(email.trim(), password, name);
      if (signUpError) {
        setError(signUpError);
      } else if (needsConfirmation) {
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("sign-in");
      }
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/landing"))}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={color.foreground} />
          </Pressable>

          <View style={styles.hero}>
            <Text style={styles.title}>{mode === "sign-in" ? "Welcome back" : "Create your account"}</Text>
            <Text style={styles.subtitle}>
              {mode === "sign-in"
                ? "Sign in to track your reports and follow every update."
                : "Report a civic issue in under a minute and follow it through to resolution."}
            </Text>
          </View>

          {mode === "sign-up" ? (
            <TextField label="Full name" placeholder="Your name" autoCapitalize="words" value={name} onChangeText={setName} />
          ) : null}

          <TextField
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextField
            label="Password"
            placeholder="At least 8 characters"
            isPassword
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChangeText={setPassword}
            hint={mode === "sign-up" ? "At least 8 characters." : undefined}
          />

          {mode === "sign-in" ? (
            <Button
              label="Forgot password?"
              variant="ghost"
              haptics={false}
              onPress={() => router.push("/forgot-password")}
              style={styles.forgotButton}
            />
          ) : null}

          {error ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          {info ? (
            <Text style={styles.infoText} accessibilityLiveRegion="polite">
              {info}
            </Text>
          ) : null}

          <Button
            label={submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
            size="hero"
            disabled={!canSubmit || submitting || !isSupabaseConfigured}
            onPress={handleSubmit}
          />

          <Button
            label={mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
            variant="secondary"
            onPress={() => {
              setError(null);
              setInfo(null);
              setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"));
            }}
          />

          <Button label="City employee? Request staff access" variant="ghost" onPress={() => router.push("/staff-request")} />

          {!isSupabaseConfigured ? (
            <View style={styles.demoBox}>
              <Text style={styles.hint}>
                No Supabase credentials configured — sign-in is disabled. You can still explore the app
                in demo mode; nothing you do there is saved.
              </Text>
              <Button label="Continue in demo mode" variant="ghost" onPress={continueAsDemo} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    padding: spacing[5],
    gap: spacing[4],
  },
  backButton: {
    alignSelf: "flex-start",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceMuted,
  },
  hero: {
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 22,
  },
  forgotButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 0,
    minHeight: 32,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
  infoText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicGreen,
  },
  demoBox: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radius.card,
    backgroundColor: color.surfaceMuted,
    gap: spacing[2],
  },
  hint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    textAlign: "center",
  },
});
