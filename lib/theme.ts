export type ThemePreference = "light" | "dark" | "system";

const themePreferenceKey = "lead-intelligence-theme";
const themeChangedEvent = "lead-intelligence-theme-change";

export const themeBootstrapScript = `(() => {
  let preference = "system";
  try {
    const savedTheme = window.localStorage.getItem(${JSON.stringify(themePreferenceKey)});
    if (savedTheme === "light" || savedTheme === "dark") {
      preference = savedTheme;
    }
  } catch (error) {
    console.warn("Could not read the saved theme preference.", error);
  }
  const isDark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = isDark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;

export function subscribeToTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    applyTheme(getThemePreferenceSnapshot());
    onChange();
  };
  window.addEventListener("storage", handleChange);
  window.addEventListener(themeChangedEvent, handleChange);
  mediaQuery.addEventListener("change", handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(themeChangedEvent, handleChange);
    mediaQuery.removeEventListener("change", handleChange);
  };
}

export function getThemePreferenceSnapshot(): ThemePreference {
  const savedTheme = window.localStorage.getItem(themePreferenceKey);
  return savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "system";
}

export function getThemeSnapshot(
  preference: ThemePreference = getThemePreferenceSnapshot(),
) {
  return (
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(themePreferenceKey);
    } else {
      window.localStorage.setItem(themePreferenceKey, preference);
    }
  } catch (error) {
    console.error("Could not save the theme preference locally.", error);
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(themeChangedEvent));
}

function applyTheme(preference: ThemePreference) {
  const isDark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = isDark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
