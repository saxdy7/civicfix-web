import { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { Redirect } from "expo-router";

import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { ScreenContainer } from "../components/ScreenContainer";
import { useAuth } from "../lib/auth-context";
import { color, fontSize, spacing } from "../lib/theme";
import type { UserRole } from "../lib/auth-context";

export default function SignIn() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("citizen");

  if (user) return <Redirect href="/(tabs)" />;

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text style={styles.title}>CivicFix</Text>
        <Text style={styles.subtitle}>Report it. Track it. Get it fixed.</Text>
      </View>

      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <View style={styles.roleRow}>
        <Button
          label="Citizen"
          variant={role === "citizen" ? "primary" : "secondary"}
          onPress={() => setRole("citizen")}
          style={styles.roleButton}
        />
        <Button
          label="Field worker"
          variant={role === "field_worker" ? "primary" : "secondary"}
          onPress={() => setRole("field_worker")}
          style={styles.roleButton}
        />
      </View>

      <Button
        label="Sign in"
        disabled={!email.includes("@")}
        onPress={() => signIn(email, role)}
      />

      <Text style={styles.hint}>
        Demo mode: any email signs you in as the selected role. Real Supabase Auth wires in later.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing[1],
    marginBottom: spacing[3],
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: color.foreground,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: color.mutedForeground,
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  roleButton: {
    flex: 1,
  },
  hint: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
    textAlign: "center",
  },
});
