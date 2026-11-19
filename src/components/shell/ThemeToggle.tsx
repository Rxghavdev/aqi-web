"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyPreferredTheme, readTheme, toggleTheme, type ThemeName } from "./theme";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<ThemeName | null>(subscribe, readTheme, () => null);

  useEffect(() => {
    applyPreferredTheme();
  }, []);

  // Until the stored theme is read, the label stays neutral so server and
  // client markup match; the icon itself follows the html data-theme in CSS.
  const label =
    theme == null ? "Switch theme" : theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        toggleTheme();
      }}
    >
      <svg
        className="theme-icon"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <mask id="hawa-moon-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect x="0" y="0" width="24" height="24" fill="#fff" stroke="none" />
          <circle className="theme-moon-cut" cx="24" cy="0" r="7" fill="#000" stroke="none" />
        </mask>
        <g mask="url(#hawa-moon-mask)">
          <circle className="theme-core" cx="12" cy="12" r="4.6" fill="currentColor" stroke="none" />
        </g>
        <g className="theme-rays">
          <path d="M12 2.5v2" />
          <path d="M12 19.5v2" />
          <path d="M2.5 12h2" />
          <path d="M19.5 12h2" />
          <path d="m5.3 5.3 1.4 1.4" />
          <path d="m17.3 17.3 1.4 1.4" />
          <path d="m5.3 18.7 1.4-1.4" />
          <path d="m17.3 6.7 1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}
