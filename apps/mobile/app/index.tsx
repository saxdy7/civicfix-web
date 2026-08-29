import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../lib/auth-context";
import { useReducedMotion } from "../lib/preferences";
import { color, fontFamily, fontSize, spacing } from "../lib/theme";

function Ripples({ reduceMotion }: { reduceMotion: boolean }) {
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [ripple, reduceMotion]);

  const rings = [0, 0.33, 0.66];

  return (
    <View style={styles.rippleStage}>
      {rings.map((offset) => {
        const progress = Animated.modulo(Animated.add(ripple, offset), 1);
        const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] });
        const opacity = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });
        return (
          <Animated.View
            key={offset}
            style={[
              styles.ring,
              reduceMotion
                ? { opacity: 0.25 }
                : { transform: [{ scale }], opacity },
            ]}
          />
        );
      })}
      <View style={styles.pinDot}>
        <Ionicons name="location" size={22} color={color.inverseForeground} />
      </View>
    </View>
  );
}

export default function Splash() {
  const { user, loading } = useAuth();
  const reduceMotion = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fade]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fade }]}>
          <Ripples reduceMotion={reduceMotion} />
          <Text style={styles.wordmark}>CivicFix</Text>
          <Text style={styles.tagline}>Report it. Track it. Get it fixed.</Text>
        </Animated.View>
        <Text style={styles.footnote}>Every report moves a city forward.</Text>
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/landing"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[7],
  },
  content: {
    alignItems: "center",
    gap: spacing[4],
  },
  rippleStage: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  ring: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: color.civicBlue,
  },
  pinDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.inverseBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  footnote: {
    position: "absolute",
    bottom: spacing[7],
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.dimForeground,
  },
});
