"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  getThemeSnapshot,
  persistThemePreference,
  subscribeToTheme,
} from "@/lib/theme";

export function PublicThemeToggle() {
  const isDarkMode = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => false,
  );
  const label = isDarkMode ? "Switch to light theme" : "Switch to dark theme";
  const Icon = isDarkMode ? Sun : Moon;

  return (
    <button
      aria-label={label}
      aria-pressed={isDarkMode}
      className="public-theme-toggle"
      onClick={() => persistThemePreference(isDarkMode ? "light" : "dark")}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}
