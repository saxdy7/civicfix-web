import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

const REDUCED_MOTION_KEY = "civicfix.reducedMotionOverride";

async function readOverride(): Promise<boolean | null> {
  try {
    const raw = Platform.OS === "web" ? null : await SecureStore.getItemAsync(REDUCED_MOTION_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

/** An explicit in-app choice always wins over the OS-level setting. */
export async function setReducedMotionOverride(value: boolean | null): Promise<void> {
  if (Platform.OS === "web") return;
  if (value === null) await SecureStore.deleteItemAsync(REDUCED_MOTION_KEY).catch(() => {});
  else await SecureStore.setItemAsync(REDUCED_MOTION_KEY, String(value)).catch(() => {});
}

/** Effective reduced-motion state: explicit app preference, else the OS setting. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    async function resolve() {
      const override = await readOverride();
      if (override !== null) {
        if (active) setReduced(override);
        return;
      }
      const osValue = (await AccessibilityInfo.isReduceMotionEnabled?.()) ?? false;
      if (active) setReduced(osValue);
    }
    resolve();
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      readOverride().then((override) => {
        if (active && override === null) setReduced(v);
      });
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
