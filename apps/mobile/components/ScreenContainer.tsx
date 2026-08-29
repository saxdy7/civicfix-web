import { ScrollView, View, StyleSheet, type ViewProps, type ScrollViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { DemoBanner } from "./DemoBanner";
import { color, spacing } from "../lib/theme";

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  refreshControl?: ScrollViewProps["refreshControl"];
  /**
   * Defaults to reserving the top inset — correct for tab screens, which
   * have no native header. Screens pushed under a real native header (for
   * the back button) must pass `edges={["left", "right"]}` so the header's
   * own top inset isn't reserved a second time, which is what produced the
   * large empty gap under "Home"/"My reports"/etc. before tab headers were
   * turned off.
   */
  edges?: Edge[];
}

export function ScreenContainer({
  scroll = true,
  refreshControl,
  edges = ["top", "left", "right"],
  style,
  children,
  ...props
}: ScreenContainerProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={edges}>
        <View style={styles.flexContent} {...props}>
          <DemoBanner />
          <View style={style}>{children}</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={refreshControl}
        {...props}
      >
        <DemoBanner />
        <View style={style}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: color.background,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
  },
  flexContent: {
    flex: 1,
    padding: spacing[4],
    gap: spacing[4],
  },
});
