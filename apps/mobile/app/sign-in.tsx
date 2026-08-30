import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";
import { isBackendConfigured } from "../lib/convex-client";
import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";

export default function SignIn() {
  const router = useRouter();
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const { user, signIn, signUp, confirmSignUp, signInWithDemoRole, continueAsDemo } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(initialMode === "sign-up" ? "sign-up" : "sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingCode, setPendingCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Redirect href="/(tabs)" />;

  // Sign-in accepts an employee ID as well as an email; sign-up always needs a real email.
  const identifierValid = mode === "sign-in" ? email.trim().length >= 3 : email.includes("@");
  const canSubmit = identifierValid && password.length >= 8 && (mode === "sign-in" || name.trim().length >= 2);

  const handleQuickDemo = async (role: "resident" | "worker" | "admin", demoEmail: string) => {
    setError(null);
    setInfo(`Logging in as ${role}…`);
    setSubmitting(true);
    try {
      const { error: demoErr } = await signInWithDemoRole(role);
      if (demoErr) {
        setEmail(demoEmail);
        setPassword("CivicFixDemo!2026");
        setError(demoErr);
      }
    } catch (e: any) {
      setError(e?.message || "Demo login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      if (mode === "sign-in") {
        const { error: signInError } = await signIn(email.trim(), password);
        if (signInError) setError(signInError);
      } else {
        const { error: signUpError, needsConfirmation } = await signUp(email.trim(), password, name);
        if (signUpError) {
          setError(signUpError);
        } else if (needsConfirmation) {
          setPendingCode(true);
        }
      }
    } catch (e: any) {
      setError(e?.message || "An error occurred during authentication.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length === 0) {
      setError("Enter the verification code.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: verifyError } = await confirmSignUp(code.trim());
      if (verifyError) {
        setError(verifyError);
      }
    } catch (e: any) {
      setError(e?.message || "Invalid verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingCode) {
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
              onPress={() => {
                setPendingCode(false);
                setError(null);
              }}
              style={styles.backButton}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={20} color={color.foreground} />
            </Pressable>

            <View style={styles.hero}>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to {email}. Enter it below to finish creating your account.
              </Text>
            </View>

            <TextField
              label="Verification code"
              placeholder="123456"
              autoCapitalize="none"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
            />

            {error ? (
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <Button
              label={submitting ? "Verifying…" : "Verify and continue"}
              size="hero"
              disabled={code.trim().length === 0 || submitting}
              onPress={handleVerify}
            />

            <Button
              label="Use a different email"
              variant="secondary"
              onPress={() => {
                setPendingCode(false);
                setError(null);
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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

          {/* Segmented Switcher */}
          <View style={styles.tabSwitcher}>
            <Pressable
              style={[styles.tabButton, mode === "sign-in" && styles.tabButtonActive]}
              onPress={() => {
                setError(null);
                setInfo(null);
                setMode("sign-in");
              }}
            >
              <Text style={[styles.tabText, mode === "sign-in" && styles.tabTextActive]}>Sign In</Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, mode === "sign-up" && styles.tabButtonActive]}
              onPress={() => {
                setError(null);
                setInfo(null);
                setMode("sign-up");
              }}
            >
              <Text style={[styles.tabText, mode === "sign-up" && styles.tabTextActive]}>Create Account</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.title}>{mode === "sign-in" ? "Welcome back" : "Create your account"}</Text>
            <Text style={styles.subtitle}>
              {mode === "sign-in"
                ? "Sign in to track your reports and follow every update."
                : "Report a civic issue in under a minute and follow it through to resolution."}
            </Text>
          </View>

          {mode === "sign-up" ? (
            <TextField label="Full name" placeholder="Jane Doe" autoCapitalize="words" value={name} onChangeText={setName} />
          ) : null}

          <TextField
            label={mode === "sign-in" ? "Email or employee ID" : "Email address"}
            placeholder={mode === "sign-in" ? "you@example.com or worker_demo" : "you@example.com"}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType={mode === "sign-in" ? "default" : "email-address"}
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
            hint={mode === "sign-up" ? "Must be at least 8 characters." : undefined}
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
            disabled={!canSubmit || submitting || !isBackendConfigured}
            onPress={handleSubmit}
          />

          {/* Quick Demo Credentials */}
          <View style={styles.quickDemoSection}>
            <Text style={styles.quickDemoTitle}>Quick Demo Sign In</Text>
            <View style={styles.demoButtonsRow}>
              <Pressable
                style={styles.demoBadgeButton}
                onPress={() => handleQuickDemo("resident", "resident_demo@example.com")}
                disabled={submitting}
              >
                <Text style={styles.demoBadgeIcon}>🏠</Text>
                <Text style={styles.demoBadgeText}>Resident</Text>
              </Pressable>

              <Pressable
                style={styles.demoBadgeButton}
                onPress={() => handleQuickDemo("worker", "worker_demo@example.com")}
                disabled={submitting}
              >
                <Text style={styles.demoBadgeIcon}>👷</Text>
                <Text style={styles.demoBadgeText}>Field Worker</Text>
              </Pressable>

              <Pressable
                style={styles.demoBadgeButton}
                onPress={() => handleQuickDemo("admin", "civicfix_admin_demo@example.com")}
                disabled={submitting}
              >
                <Text style={styles.demoBadgeIcon}>🛡️</Text>
                <Text style={styles.demoBadgeText}>Admin</Text>
              </Pressable>
            </View>
          </View>

          <Button label="City employee? Request staff access" variant="ghost" onPress={() => router.push("/staff-request")} />

          {!isBackendConfigured ? (
            <View style={styles.demoBox}>
              <Text style={styles.hint}>
                Backend not configured — sign-in is disabled. You can still explore the app
                in demo mode.
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
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.pill,
    padding: 3,
    marginTop: spacing[1],
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: "center",
    borderRadius: radius.pill,
  },
  tabButtonActive: {
    backgroundColor: color.surface,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.mutedForeground,
  },
  tabTextActive: {
    color: color.foreground,
    fontFamily: fontFamily.semibold,
  },
  hero: {
    gap: spacing[1],
    marginBottom: spacing[1],
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
  quickDemoSection: {
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    gap: spacing[2],
  },
  quickDemoTitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.dimForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  demoButtonsRow: {
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
  },
  demoBadgeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    backgroundColor: color.surfaceMuted,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
  },
  demoBadgeIcon: {
    fontSize: 14,
  },
  demoBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    color: color.foreground,
  },
  demoBox: {
    marginTop: spacing[2],
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
