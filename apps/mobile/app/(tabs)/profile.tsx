import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { useAuth } from "../../lib/auth-context";
import { color, fontSize, spacing } from "../../lib/theme";

export default function Profile() {
  const router = useRouter();
  const { user, signOut, setRole } = useAuth();

  if (!user) return null;

  return (
    <ScreenContainer>
      <Card>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.role}>Role: {user.role === "citizen" ? "Citizen" : "Field worker"}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Demo role switch</Text>
        <Text style={styles.cardHint}>Toggle to preview the field-worker assignment flows.</Text>
        <View style={styles.roleRow}>
          <Button
            label="Citizen"
            variant={user.role === "citizen" ? "primary" : "secondary"}
            onPress={() => setRole("citizen")}
            style={{ flex: 1 }}
          />
          <Button
            label="Field worker"
            variant={user.role === "field_worker" ? "primary" : "secondary"}
            onPress={() => setRole("field_worker")}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Button label="Notifications" variant="secondary" onPress={() => router.push("/notifications")} />
      <Button label="Sign out" variant="danger" onPress={signOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: color.foreground,
  },
  email: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
  role: {
    fontSize: fontSize.sm,
    color: color.foreground,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: color.foreground,
  },
  cardHint: {
    fontSize: fontSize.sm,
    color: color.mutedForeground,
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
});
