import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { convexClient } from "./convex-client";

import { api } from "../../../convex/_generated/api";

/**
 * Registers this device for push notifications and stores the token via
 * `notifications.registerDeviceToken` (Convex derives the owning user from
 * the caller's Clerk identity — no userId to pass).
 *
 * IMPORTANT — this is real and testable today, but it is not full FCM/APNs
 * wiring: it requests the OS notification permission and captures an
 * **Expo push token** (Expo's own relay service), which works in Expo Go and
 * dev builds with zero Firebase setup. Getting a real device-specific FCM
 * token (and actually delivering pushes) requires a Firebase project
 * (`google-services.json` / `GoogleService-Info.plist`) and EAS push
 * credentials the developer has to provision — that's a specific follow-up,
 * not something this client can configure on its own. Nothing currently
 * sends a push either way; there is no backend job wired up to deliver one.
 */
export async function registerForPushNotifications(
  _userId: string,
): Promise<{ granted: boolean; token: string | null; error: string | null }> {
  if (!Device.isDevice) {
    return { granted: false, token: null, error: "Push notifications require a physical device." };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    return { granted: false, token: null, error: null };
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    if (convexClient) {
      await convexClient.mutation(api.notifications.registerDeviceToken, { fcmToken: data, platform: Platform.OS });
    }
    return { granted: true, token: data, error: null };
  } catch (err) {
    return { granted: true, token: null, error: err instanceof Error ? err.message : "Could not register for push." };
  }
}
