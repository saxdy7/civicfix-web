import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True when Supabase env vars are configured. When false, auth-context and
 * the repositories fall back to clearly-labelled local demo data — see
 * lib/demo-data.ts and components/DemoBanner.tsx. Never treat missing
 * config as "sign in anyway" the way the old demo auth did.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

// iOS Keychain / Android Keystore — not plain AsyncStorage — for the auth
// session on the app's actual target platforms. Access/refresh tokens for a
// project this size comfortably fit under SecureStore's per-item limit; if
// that ever becomes a problem, wrap this in the AES+AsyncStorage
// "LargeSecureStore" pattern from Supabase's own Expo guide instead of
// switching back to unencrypted storage.
//
// expo-secure-store has no web implementation at all (calling it throws) —
// web is not a target platform for this app (only iOS/Android are), but
// `expo start --web` is still a common local dev-preview workflow, so this
// falls back to `localStorage` there rather than crashing on load. Native
// builds never take this branch.
const ExpoSecureStoreAdapter =
  Platform.OS === "web"
    ? {
        getItem: async (key: string) => (typeof localStorage === "undefined" ? null : localStorage.getItem(key)),
        setItem: async (key: string, value: string) => {
          if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          if (typeof localStorage !== "undefined") localStorage.removeItem(key);
        },
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// supabase-js's background token refresh timer keeps firing while the app is
// backgrounded unless told otherwise — this is Supabase's documented pattern
// for React Native to stop/start it with app foreground state.
if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
