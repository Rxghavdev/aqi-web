"use client";

export type ThemeName = "light" | "dark";

const KEY = "aqi-desk-theme";

export function readTheme(): ThemeName {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function preferredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* private mode */
  }
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
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode */
  }
  return next;
}
