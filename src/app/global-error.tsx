"use client";

import { Inter_Tight } from "next/font/google";
import { useEffect } from "react";
import { SITE_NAME } from "@/lib/site";

const app = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

/**
 * Last resort, when the root layout itself fails. It replaces the layout, so it
 * brings its own document, font and a small copy of the colour tokens: the
 * global stylesheet is not loaded here. Follows the visitor's stored theme,
 * else the system setting.
 */
const CSS = `
:root{--paper:#f4efe6;--ink:#1a1714;--muted:#6b645c;--hairline:#e3d8c8;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#100e0c;--ink:#f4efe6;--muted:#b1a79c;--hairline:#2c2822;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#100e0c;--ink:#f4efe6;--muted:#b1a79c;--hairline:#2c2822;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.25rem;background:var(--paper);color:var(--ink);font-family:var(--font-app),ui-sans-serif,system-ui,sans-serif}
main{width:100%;max-width:30rem}
.brand{margin:0 0 1.5rem;font-size:.8rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{margin:0;font-size:clamp(1.9rem,6vw,2.6rem);font-weight:700;letter-spacing:-.03em;line-height:1.05}
p{margin:.85rem 0 0;color:var(--muted);font-size:1.05rem;line-height:1.5}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:1.1rem;margin-top:1.6rem}
button{min-height:44px;padding:0 1.4rem;border:0;border-radius:999px;background:var(--ink);color:var(--paper);font:inherit;font-weight:600;cursor:pointer}
a{color:var(--ink);text-underline-offset:.18em}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
`;

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem("hawa-theme");
      if (stored === "light" || stored === "dark") {
        document.documentElement.dataset.theme = stored;
      }
    } catch {
      /* private mode: the system setting applies */
    }
    const digest =
      error && typeof error === "object" && "digest" in error
        ? String((error as { digest?: unknown }).digest)
        : undefined;
    console.error("global error", digest);
  }, [error]);

  return (
    <html lang="en" className={app.variable}>
      <head>
        <title>{`Something went wrong · ${SITE_NAME}`}</title>
        <style>{CSS}</style>
      </head>
      <body>
        <main role="alert">
          <p className="brand">{SITE_NAME}</p>
          <h1>Something went wrong on our side.</h1>
          <p>Try again in a moment.</p>
          <div className="actions">
            <button type="button" onClick={() => retry()}>
              Retry
            </button>
            {/* A full page load: the router may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Back to home</a>
          </div>
        </main>
      </body>
    </html>
  );
}
