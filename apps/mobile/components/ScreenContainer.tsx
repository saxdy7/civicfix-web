import { ScrollView, View, StyleSheet, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { color, spacing } from "../lib/theme";

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
}

export function ScreenContainer({ scroll = true, style, children, ...props }: ScreenContainerProps) {
  const Wrapper = scroll ? ScrollView : View;
  const wrapperProps = scroll
    ? { contentContainerStyle: styles.scrollContent }
    : { style: styles.flexContent };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Wrapper {...wrapperProps} {...props}>
        <View style={style}>{children}</View>
      </Wrapper>
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
