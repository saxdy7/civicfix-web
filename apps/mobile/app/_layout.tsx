import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { AuthProvider } from "../lib/auth-context";
import { clerkTokenCache } from "../lib/clerk-token-cache";
import { convexClient, isConvexConfigured } from "../lib/convex-client";
import { ThemeProvider, useTheme } from "../lib/theme-context";
import { fontFamily } from "../lib/theme";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function BackendProviders({ children }: PropsWithChildren) {
  if (!clerkPublishableKey) {
    return (
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
      {isConvexConfigured && convexClient ? (
        <ConvexProviderWithClerk client={convexClient} useAuth={useClerkAuth}>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </ConvexProviderWithClerk>
      ) : (
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      )}
    </ClerkProvider>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: fontFamily.semibold, color: colors.foreground },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="landing" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
        <Stack.Screen name="staff-request" options={{ title: "Staff access" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="report/confirmation" options={{ headerShown: false }} />
        <Stack.Screen name="reports/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="assignments/[id]/index" options={{ title: "Assignment" }} />
        <Stack.Screen name="assignments/[id]/evidence" options={{ title: "Resolution evidence" }} />
        <Stack.Screen name="assignments/[id]/navigate" options={{ title: "Navigate" }} />
        <Stack.Screen name="sync-queue" options={{ title: "Offline sync queue" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
        .catch(() => {})
        .finally(() => setReady(true));
    }
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(() => {}, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <BackendProviders>
          <RootNavigator />
        </BackendProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
