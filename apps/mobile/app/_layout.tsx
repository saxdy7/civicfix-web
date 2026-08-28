import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerBackTitle: "Back" }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="report/confirmation" options={{ title: "Report submitted", headerBackVisible: false }} />
            <Stack.Screen name="reports/[id]" options={{ title: "Report status" }} />
            <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
            <Stack.Screen name="assignments/[id]" options={{ title: "Assignment" }} />
            <Stack.Screen name="assignments/[id]/evidence" options={{ title: "Resolution evidence" }} />
            <Stack.Screen name="assignments/[id]/navigate" options={{ title: "Navigate" }} />
            <Stack.Screen name="sync-queue" options={{ title: "Offline sync queue" }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
