import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { darkColors, lightColors, type ColorPalette, type ThemeType } from "./theme";

const THEME_STORAGE_KEY = "civicfix.theme_mode.v1";

interface ThemeContextValue {
  theme: ThemeType;
  colors: ColorPalette;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (t: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  colors: lightColors,
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  // Default is "light" (White Theme) per user requirement
  const [theme, setThemeState] = useState<ThemeType>("light");

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS !== "web") {
          const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
          if (saved === "dark" || saved === "light") {
            setThemeState(saved);
          }
        }
      } catch {
        // Fallback to default light
      }
    })();
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    if (Platform.OS !== "web") {
      SecureStore.setItemAsync(THEME_STORAGE_KEY, newTheme).catch(() => {});
    }
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  const colors = theme === "dark" ? darkColors : lightColors;
  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
