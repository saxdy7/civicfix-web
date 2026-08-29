import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

interface TokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, value: string) => Promise<void>;
}

/**
 * iOS Keychain / Android Keystore — not plain AsyncStorage — for Clerk's
 * session JWTs, same rationale the old Supabase SecureStore adapter used.
 * expo-secure-store has no web implementation (calling it throws), and web
 * is not a target platform for this app — `expo start --web` is still a
 * common local dev-preview workflow, so the cache is a safe no-op there
 * rather than crashing on load.
 */
export const clerkTokenCache: TokenCache | undefined =
  Platform.OS === "web"
    ? undefined
    : {
        async getToken(key: string) {
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            return null;
          }
        },
        async saveToken(key: string, value: string) {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch {
            // Ignore — worst case, the user is asked to sign in again.
          }
        },
      };
