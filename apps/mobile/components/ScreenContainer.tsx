import { ScrollView, View, StyleSheet, type ViewProps, type ScrollViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { DemoBanner } from "./DemoBanner";
import { useTheme } from "../lib/theme-context";
import { spacing } from "../lib/theme";

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  refreshControl?: ScrollViewProps["refreshControl"];
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
  const { colors } = useTheme();

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={edges}>
        <View style={styles.flexContent} {...props}>
          <DemoBanner />
          <View style={style}>{children}</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={edges}>
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
