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
import { color, fontFamily } from "../lib/theme";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Clerk owns identity; when it's configured, Convex subscribes to it via
 * ConvexProviderWithClerk so every query/mutation automatically carries the
 * signed-in user's Clerk JWT (same pattern as apps/web's
 * ConvexClerkProvider.tsx). Requires a JWT template named "convex" in the
 * Clerk dashboard — already set up for the web app's use of the same Clerk
 * instance. Without Clerk configured at all, children render with no auth
 * provider chain beyond AuthProvider's own demo fallback.
 */
function BackendProviders({ children }: PropsWithChildren) {
  if (!clerkPublishableKey) return <AuthProvider>{children}</AuthProvider>;

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
      {isConvexConfigured && convexClient ? (
        <ConvexProviderWithClerk client={convexClient} useAuth={useClerkAuth}>
          <AuthProvider>{children}</AuthProvider>
        </ConvexProviderWithClerk>
      ) : (
        <AuthProvider>{children}</AuthProvider>
      )}
    </ClerkProvider>
  );
}

// Keep the native splash up until Inter is loaded — the custom animated
// splash screen (app/index.tsx) takes over from there while the session is
// being checked, so the user is never looking at a blank frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.background }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <BackendProviders>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerBackTitle: "Back",
              headerStyle: { backgroundColor: color.background },
              headerTintColor: color.foreground,
              headerTitleStyle: { fontFamily: fontFamily.semibold, color: color.foreground },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: color.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="landing" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
            <Stack.Screen name="staff-request" options={{ title: "Staff access" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="report/confirmation" options={{ headerShown: false }} />
            <Stack.Screen name="reports/[id]" options={{ title: "Report status" }} />
            <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
            <Stack.Screen name="assignments/[id]" options={{ title: "Assignment" }} />
            <Stack.Screen name="assignments/[id]/evidence" options={{ title: "Resolution evidence" }} />
            <Stack.Screen name="assignments/[id]/navigate" options={{ title: "Navigate" }} />
            <Stack.Screen name="sync-queue" options={{ title: "Offline sync queue" }} />
          </Stack>
        </BackendProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
