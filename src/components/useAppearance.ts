import { useEffect, useLayoutEffect, useState } from "react";
export const APPEARANCE_KEY = "integration-scenario-studio.appearance";
export type Appearance = "system" | "light" | "dark";
export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      const saved = localStorage.getItem(APPEARANCE_KEY);
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media?.matches ?? false);
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, []);
  const theme =
    appearance === "system" ? (systemDark ? "dark" : "light") : appearance;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  function choose(value: Appearance) {
    setAppearance(value);
    try {
      localStorage.setItem(APPEARANCE_KEY, value);
    } catch {
      /* Appearance still works when browser storage is unavailable. */
    }
  }
  return { appearance, setAppearance: choose, theme };
}
