import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { StyleSheet } from "react-native";

import { useAuth } from "../../lib/auth-context";
import { color, fontFamily, fontSize } from "../../lib/theme";

export default function TabsLayout() {
  const { user } = useAuth();

  if (!user) return <Redirect href="/sign-in" />;

  const isFieldWorker = user.role === "field_worker";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: color.foreground,
        tabBarInactiveTintColor: color.dimForeground,
        tabBarStyle: {
          backgroundColor: color.background,
          borderTopColor: color.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
        // Every tab screen renders its own cinematic heading inside
        // ScreenContainer (whose SafeAreaView already reserves the top
        // inset) — a native header here would double that top spacing,
        // which is exactly the large empty gap seen under "Home"/"Report"/
        // "My reports" in review. Custom headings replace it instead.
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color: c, size }) => <Ionicons name="home-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          href: isFieldWorker ? null : undefined,
          tabBarIcon: ({ color: c, size }) => <Ionicons name="add-circle-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="my-reports"
        options={{
          title: "My reports",
          href: isFieldWorker ? null : undefined,
          tabBarIcon: ({ color: c, size }) => <Ionicons name="document-text-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: "Assignments",
          href: isFieldWorker ? undefined : null,
          tabBarIcon: ({ color: c, size }) => <Ionicons name="clipboard-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color: c, size }) => <Ionicons name="person-outline" size={size} color={c} />,
        }}
      />
    </Tabs>
  );
}
