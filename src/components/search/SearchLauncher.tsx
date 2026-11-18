"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SearchIcon } from "./icons";
import { FOCUS_SEARCH_EVENTS } from "./events";
import { SearchPalette } from "./SearchPalette";

type Phase = "closed" | "open" | "closing";

const EXIT_MS = 160;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * The header search control. A pill on desktop, an icon on phones. It opens the
 * palette from a click, "/" or Cmd/Ctrl+K from anywhere on the site.
 */
export function SearchLauncher() {
  const [phase, setPhase] = useState<Phase>("closed");
  const phaseRef = useRef<Phase>("closed");
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const open = useCallback(() => {
    if (phaseRef.current === "open") return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const current = document.activeElement;
    const visible = [pillRef.current, iconRef.current].find(
      (button) => button && button.offsetParent !== null,
    );
    returnRef.current =
      current instanceof HTMLElement && current !== document.body && current !== document.documentElement
        ? current
        : (visible ?? null);
    update("open");
  }, [update]);

  const close = useCallback(
    (options?: { restore?: boolean }) => {
      if (phaseRef.current !== "open") return;
      const restore = options?.restore !== false;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      update("closing");
      timerRef.current = setTimeout(
        () => {
          update("closed");
          if (restore) returnRef.current?.focus();
          returnRef.current = null;
        },
        reduce ? 0 : EXIT_MS,
      );
    },
    [update],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (phaseRef.current === "open") close();
        else open();
        return;
      }
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditable(event.target) &&
        phaseRef.current !== "open"
      ) {
        event.preventDefault();
        open();
      }
    }
    function onAsk() {
      // A page with its own search field focuses that; elsewhere use the palette.
      if (document.querySelector("[data-hero-search]")) return;
      open();
    }
    document.addEventListener("keydown", onKey);
    for (const name of FOCUS_SEARCH_EVENTS) window.addEventListener(name, onAsk);
    return () => {
      document.removeEventListener("keydown", onKey);
      for (const name of FOCUS_SEARCH_EVENTS) window.removeEventListener(name, onAsk);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [open, close]);

  const expanded = phase === "open";

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className="search-pill"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-keyshortcuts="/ Control+K Meta+K"
        onClick={open}
      >
        <SearchIcon width={18} height={18} />
        <span className="search-pill-text">Search city or station</span>
        <kbd className="search-pill-key" aria-hidden="true">
          /
        </kbd>
      </button>
      <button
        ref={iconRef}
        type="button"
        className="icon-button search-icon-button"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-label="Search city or station"
        onClick={open}
      >
        <SearchIcon width={20} height={20} />
      </button>
      {phase !== "closed"
        ? createPortal(<SearchPalette phase={phase} onClose={close} />, document.body)
        : null}
    </>
  );
}
