import { ScrollView, View, StyleSheet, type ViewProps, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DemoBanner } from "./DemoBanner";
import { color, spacing } from "../lib/theme";

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  refreshControl?: ScrollViewProps["refreshControl"];
}

export function ScreenContainer({
  scroll = true,
  refreshControl,
  style,
  children,
  ...props
}: ScreenContainerProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.flexContent} {...props}>
          <DemoBanner />
          <View style={style}>{children}</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
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
