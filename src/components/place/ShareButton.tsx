"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/reading/icons";

/**
 * Shares a page. Uses the system share sheet where there is one, and copies
 * the link otherwise. `path` lets a page share a clean URL (for example a
 * station) instead of an address that carries the visitor's coordinates.
 */
export function ShareButton({
  title,
  text,
  path,
}: {
  title: string;
  text: string;
  path?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function say(message: string) {
    setToast(message);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2400);
  }

  async function share() {
    const url = path
      ? new URL(path, window.location.origin).toString()
      : window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        // Any other failure falls through to copying the link.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied");
    } catch {
      say("Could not copy the link");
    }
  }

  return (
    <>
      <button type="button" className="share-btn" onClick={share}>
        <Icon name="share" size={18} />
        <span>Share</span>
      </button>
      <p className="toast" role="status" aria-live="polite">
        {toast ? <span className="toast-pill">{toast}</span> : null}
      </p>
    </>
  );
}
