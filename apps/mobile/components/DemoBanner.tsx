import { Text, View, StyleSheet } from "react-native";

import { isSupabaseConfigured } from "../lib/supabase";
import { color, fontSize, radius, spacing } from "../lib/theme";

/**
 * Shown on every screen (via ScreenContainer) whenever Supabase isn't
 * configured, so the local demo fallback can never be mistaken for a real
 * account or live data.
 */
export function DemoBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>DEMO MODE — not connected to Supabase, nothing here is real</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: color.civicAmber,
    borderRadius: radius.control,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: "#1a1200",
    textAlign: "center",
  },
});
