import { useContext } from "react";
import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { SettingsContext } from "@/contexts/SettingsContext";

/**
 * Returns the design tokens for the current effective theme.
 *
 * Reads from SettingsContext (user preference: System / Light / Dark).
 * Falls back to the device's system theme when SettingsContext is not available.
 */
export function useColors() {
  const settings = useContext(SettingsContext);
  const systemScheme = useColorScheme();

  const scheme: "light" | "dark" = settings?.effectiveTheme
    ?? (systemScheme === "dark" ? "dark" : "light");

  const palette = scheme === "dark" ? colors.dark : colors.light;

  return { ...palette, radius: colors.radius };
}
