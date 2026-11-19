export type ThemePreference = "light" | "dark" | "system";

const themePreferenceKey = "lead-intelligence-theme";
const themeChangedEvent = "lead-intelligence-theme-change";

export function subscribeToTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onChange);
  window.addEventListener(themeChangedEvent, onChange);
  mediaQuery.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(themeChangedEvent, onChange);
    mediaQuery.removeEventListener("change", onChange);
  };
}

export function getThemePreferenceSnapshot(): ThemePreference {
  const savedTheme = window.localStorage.getItem(themePreferenceKey);
  return savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "system";
}

export function getThemeSnapshot() {
  const preference = getThemePreferenceSnapshot();
  return (
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export function persistThemePreference(preference: ThemePreference) {
  if (preference === "system") {
    window.localStorage.removeItem(themePreferenceKey);
  } else {
    window.localStorage.setItem(themePreferenceKey, preference);
  }
  window.dispatchEvent(new Event(themeChangedEvent));
}
