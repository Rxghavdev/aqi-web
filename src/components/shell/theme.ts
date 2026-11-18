"use client";

export type ThemeName = "light" | "dark";

export const THEME_KEY = "hawa-theme";
/** Read-only fallback so visitors keep the choice they made before the rename. */
const LEGACY_THEME_KEY = "aqi-desk-theme";

export function readTheme(): ThemeName {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function storedTheme(): ThemeName | null {
  try {
    const current = localStorage.getItem(THEME_KEY);
    if (current === "dark" || current === "light") return current;
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark" || legacy === "light") return legacy;
  } catch {
    /* private mode */
  }
  return null;
}

export function preferredTheme(): ThemeName {
  const stored = storedTheme();
  if (stored) return stored;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyPreferredTheme(): ThemeName {
  const theme = preferredTheme();
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function toggleTheme(): ThemeName {
  const next: ThemeName = readTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* private mode */
  }
  return next;
}
