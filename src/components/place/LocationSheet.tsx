"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOC_KEY, writePoint, writeSkip } from "./storage";

const DENIED = "Location stayed off. Search for your city instead.";

export function LocationSheet() {
  const router = useRouter();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const searching = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(LOC_KEY) == null) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    function dismiss() {
      writeSkip();
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const nodes = [...sheet.querySelectorAll<HTMLElement>("button, a, input, [href]")].filter(
        (node) => !node.hasAttribute("disabled"),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      body.style.overflow = previousOverflow;
      if (!searching.current && previous instanceof HTMLElement) previous.focus();
      searching.current = false;
    };
  }, [open]);

  function skip() {
    writeSkip();
    setOpen(false);
  }

  function searchInstead() {
    searching.current = true;
    writeSkip();
    setOpen(false);
    window.setTimeout(() => {
      window.dispatchEvent(new Event("aqi-desk-focus-search"));
    }, 40);
  }

  function locate() {
    setNote(null);
    if (!("geolocation" in navigator)) {
      setNote(DENIED);
      writeSkip();
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        writePoint(Number(lat), Number(lon));
        setPending(false);
        setOpen(false);
        router.push(`/near?lat=${lat}&lon=${lon}`);
      },
      (error) => {
        setPending(false);
        if (error.code === error.PERMISSION_DENIED) {
          setNote(DENIED);
          writeSkip();
          return;
        }
        setNote("Location could not be read. Search for your city instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  if (!open) return null;

  return (
    <div className="loc-root">
      <div className="loc-backdrop" onClick={skip} />
      <div
        ref={sheetRef}
        className="loc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="loc-top">
          <p className="kicker">WHERE ARE YOU BREATHING</p>
          <button ref={closeRef} type="button" className="loc-close" onClick={skip}>
            Close
          </button>
        </div>
        <h2 id={titleId} className="loc-title">
          We&apos;ll find the nearest government station.
        </h2>
        <p className="loc-body">
          Not a guess from your street. The official monitor, and how far it is.
        </p>
        {note ? (
          <p className="loc-note" role="status">
            {note}
          </p>
        ) : null}
        <button
          type="button"
          className="loc-primary"
          onClick={locate}
          disabled={pending}
          aria-busy={pending}
        >
          Use my location
        </button>
        <button type="button" className="loc-secondary" onClick={searchInstead}>
          I&apos;ll search
        </button>
      </div>
    </div>
  );
}
