"use client";

import { useEffect } from "react";
import { applyPreferredTheme, toggleTheme } from "./theme";

export function ThemeToggle() {
  useEffect(() => {
    applyPreferredTheme();
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => {
        toggleTheme();
      }}
    >
      <span className="theme-when-light">Dark</span>
      <span className="theme-when-dark">Light</span>
    </button>
  );
}
