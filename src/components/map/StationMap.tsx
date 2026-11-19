"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import Link from "next/link";
import { bandAccent } from "@/lib/aqi";
import { stampIsToday } from "@/components/reading/text";
import type { Band } from "@/lib/types";
import { MapCanvas, type MapFrameData, type MapHandle, type MapPoint } from "./MapCanvas";
import { MapDialog } from "./MapDialog";
import { PinCard } from "./PinCard";
import { cityPins, safeMapHref, type MapPin } from "./pins";

type Scope = "here" | "india";

const HINT_KEY = "hawa-map-hint";
const HINT_TEXT = "Use two fingers to move the map";
const LIST_SELECTOR = "[data-stations-list], #stations, .rank-list";

const LEGEND: { band: Band; label: string; range: string }[] = [
  { band: "Good", label: "Good", range: "0 to 50" },
  { band: "Satisfactory", label: "Satisfactory", range: "51 to 100" },
  { band: "Moderate", label: "Moderate", range: "101 to 200" },
  { band: "Poor", label: "Poor", range: "201 to 300" },
  { band: "Very Poor", label: "Very Poor", range: "301 to 400" },
  { band: "Severe", label: "Severe", range: "401 to 500" },
];

export function StationMap({
  pins,
  activeSlug = null,
  user = null,
  hereLabel = "Here",
  frame = "stage-map",
}: {
  pins: MapPin[];
  activeSlug?: string | null;
  user?: MapPoint | null;
  hereLabel?: string;
  frame?: string;
}) {
  const hereKey = `${activeSlug ?? ""}:${pins.length}:${pins[0]?.slug ?? ""}:${pins.at(-1)?.slug ?? ""}`;

  // Scope is derived from the current pin set rather than reset by an effect:
  // a choice only applies while the pins are unchanged.
  const defaultScope: Scope = pins.length > 0 ? "here" : "india";
  const [choice, setChoice] = useState<{ key: string; scope: Scope } | null>(null);
  const scope = choice && choice.key === hereKey ? choice.scope : defaultScope;
  const setScope = (next: Scope) => setChoice({ key: hereKey, scope: next });

  const sectionRef = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const escapeRef = useRef<(() => boolean) | null>(null);

  // The map mounts only when it is about to scroll into view. Until then the
  // frame is a skeleton of the same size, so nothing moves when it arrives.
  useEffect(() => {
    if (armed) return;
    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setArmed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [armed]);

  const [indiaPins, setIndiaPins] = useState<MapPin[] | null>(null);
  const [indiaError, setIndiaError] = useState(false);

  useEffect(() => {
    if (scope !== "india" || indiaPins || !armed) return;
    const controller = new AbortController();
    setIndiaError(false);
    fetch("/api/map", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("map");
        const data: unknown = await response.json();
        const cities =
          data && typeof data === "object" ? (data as { cities?: unknown }).cities : null;
        setIndiaPins(cityPins(cities));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setIndiaError(true);
      });
    return () => controller.abort();
  }, [scope, indiaPins, armed]);

  const shown = scope === "here" ? pins : (indiaPins ?? []);
  const framed = useMemo<MapFrameData>(
    () => ({
      pins: shown,
      activeSlug: scope === "here" ? activeSlug : null,
      user,
      fitKey: `${scope}:${shown.map((pin) => pin.slug).join("|")}:${user ? `${user.lat.toFixed(3)},${user.lon.toFixed(3)}` : ""}`,
    }),
    // `shown` is derived from these three; listing it would rebuild the frame
    // on every render because it is a fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pins, indiaPins, scope, activeSlug, user],
  );

  const live = useUpdatedToday(pins, armed);
  const status = scope === "india" && indiaError ? "City averages could not load." : null;

  const shared = {
    frameData: framed,
    pins,
    scope,
    hereLabel,
    onScope: setScope,
    selectionKey: `${hereKey}:${scope}`,
    live,
    status,
  };

  return (
    <>
      <MapSurface
        {...shared}
        className={`${frame} map-frame`}
        sectionRef={sectionRef}
        armed={armed}
        onExpand={(button) => {
          openerRef.current = button;
          setArmed(true);
          setExpanded(true);
        }}
      />
      {expanded ? (
        <MapDialog
          title="Map of air quality readings"
          onClose={() => setExpanded(false)}
          escapeRef={escapeRef}
          openerRef={openerRef}
        >
          {(closeButton) => (
            <MapSurface
              {...shared}
              className="map-frame is-expanded"
              armed
              expanded
              closeButton={closeButton}
              escapeRef={escapeRef}
            />
          )}
        </MapDialog>
      ) : null}
    </>
  );
}

type SurfaceProps = {
  frameData: MapFrameData;
  pins: MapPin[];
  scope: Scope;
  hereLabel: string;
  onScope: (scope: Scope) => void;
  selectionKey: string;
  live: boolean;
  status: string | null;
  className: string;
  armed: boolean;
  expanded?: boolean;
  sectionRef?: RefObject<HTMLElement | null>;
  onExpand?: (button: HTMLElement) => void;
  closeButton?: React.ReactNode;
  escapeRef?: MutableRefObject<(() => boolean) | null>;
};

/** One map with its chrome. The page renders one; the expanded dialog renders a second. */
function MapSurface({
  frameData,
  pins,
  scope,
  hereLabel,
  onScope,
  selectionKey,
  live,
  status,
  className,
  armed,
  expanded = false,
  sectionRef,
  onExpand,
  closeButton,
  escapeRef,
}: SurfaceProps) {
  const handleRef = useRef<MapHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<{ key: string; pin: MapPin } | null>(null);
  const selected = picked && picked.key === selectionKey ? picked.pin : null;
  const [located, setLocated] = useState<MapPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [canLocate, setCanLocate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasList, setHasList] = useState(false);

  const select = (pin: MapPin | null) =>
    setPicked(pin ? { key: selectionKey, pin } : null);

  useEffect(() => {
    setCanLocate("geolocation" in navigator);
    if (!expanded) setHasList(document.querySelector(LIST_SELECTOR) != null);
  }, [expanded]);

  // Esc closes the pin card. In the dialog the dialog asks first, so the first
  // Esc closes the card and the second closes the map.
  useEffect(() => {
    if (expanded && escapeRef) {
      escapeRef.current = () => {
        if (!selected) return false;
        setPicked(null);
        return true;
      };
      return () => {
        escapeRef.current = null;
      };
    }
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicked(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, escapeRef, selected]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const frameWithUser = useMemo<MapFrameData>(
    () => ({ ...frameData, user: frameData.user ?? located }),
    [frameData, located],
  );

  const locate = () => {
    if (!("geolocation" in navigator) || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        setLocating(false);
        setLocated(point);
        handleRef.current?.flyTo(point, 10);
      },
      () => {
        setLocating(false);
        setNotice("Your location is not available.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const showHint = () => {
    if (hintSeen()) return;
    markHintSeen();
    setNotice(HINT_TEXT);
  };

  const jumpToList = () => {
    const target = document.querySelector<HTMLElement>(LIST_SELECTOR);
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  };

  const message = status ?? notice;
  const here = scope === "here" && pins.length > 0;

  return (
    <section
      ref={sectionRef}
      className={className}
      aria-label="Map of air quality readings"
      data-card={selected ? "open" : undefined}
      data-ready={ready ? "true" : undefined}
    >
      {!expanded && hasList ? (
        <button type="button" className="map-skip" onClick={jumpToList}>
          View stations as a list
        </button>
      ) : null}

      {armed ? (
        <MapCanvas
          frame={frameWithUser}
          selectedSlug={selected?.slug ?? null}
          cooperative={!expanded}
          handleRef={handleRef}
          onSelect={select}
          onReady={() => setReady(true)}
          onHint={showHint}
        />
      ) : null}
      <div className="map-loading" aria-hidden="true" />

      <div className="map-tl">
        <p className="map-badge">
          {live ? <span className="map-live" aria-hidden="true" /> : null}
          Official
          {live ? <span className="sr-only">, updated today</span> : null}
        </p>
        {pins.length > 0 ? (
          <div className="map-scope" role="group" aria-label="Map extent">
            <button
              type="button"
              aria-pressed={scope === "here"}
              onClick={() => {
                onScope("here");
                setPicked(null);
              }}
            >
              {hereLabel}
            </button>
            <button
              type="button"
              aria-pressed={scope === "india"}
              onClick={() => {
                onScope("india");
                setPicked(null);
              }}
            >
              India
            </button>
          </div>
        ) : null}
      </div>

      <div className="map-tools">
        {expanded ? (
          closeButton
        ) : (
          <button
            type="button"
            className="map-btn"
            aria-label="Expand map"
            aria-haspopup="dialog"
            onClick={(event) => onExpand?.(event.currentTarget)}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <div className="map-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="map-btn"
            aria-label="Zoom in"
            disabled={!ready}
            onClick={() => handleRef.current?.zoomIn()}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="map-btn"
            aria-label="Zoom out"
            disabled={!ready}
            onClick={() => handleRef.current?.zoomOut()}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {canLocate ? (
          <button
            type="button"
            className="map-btn"
            aria-label="Show my location"
            aria-busy={locating || undefined}
            disabled={!ready || locating}
            onClick={locate}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      <ul className="map-legend" aria-label="AQI bands">
        {LEGEND.map((item) => (
          <li key={item.band}>
            <span className="map-legend-bar" style={{ background: bandAccent(item.band) }} />
            <span className="map-legend-name">{item.label}</span>
            <span className="sr-only"> {item.range}</span>
          </li>
        ))}
      </ul>

      {message ? (
        <p className="map-notice" role="status">
          {message}
        </p>
      ) : null}

      {selected ? <PinCard key={selected.slug} pin={selected} onClose={() => setPicked(null)} /> : null}

      {!expanded && here ? (
        <ul className="sr-only" aria-label="Stations on this map">
          {pins.slice(0, 60).map((pin) => {
            const href = safeMapHref(pin.href);
            const text = `${pin.name}${pin.place ? `, ${pin.place}` : ""}. AQI ${pin.aqi ?? "not available"}${pin.band ? `, ${pin.band}` : ""}`;
            return <li key={pin.slug}>{href ? <Link href={href}>{text}</Link> : text}</li>;
          })}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * True when the data on the map was published today (IST). Station pins carry
 * a stamp; the all-India pins do not, so those fall back to the snapshot time.
 */
function useUpdatedToday(pins: MapPin[], enabled: boolean): boolean {
  const stamped = pins.some((pin) => pin.updatedAt != null);
  const [fromPins, setFromPins] = useState(false);
  const [fromSnapshot, setFromSnapshot] = useState(false);

  useEffect(() => {
    setFromPins(pins.some((pin) => stampIsToday(pin.updatedAt)));
  }, [pins]);

  useEffect(() => {
    if (stamped || !enabled) return;
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!data || typeof data !== "object") return;
        const { snapshotAt, stale } = data as { snapshotAt?: unknown; stale?: unknown };
        if (typeof snapshotAt !== "string" || stale === true) return;
        setFromSnapshot(sameDayIst(snapshotAt));
      })
      .catch(() => {
        /* No dot is the safe answer when the status cannot be read. */
      });
    return () => controller.abort();
  }, [stamped, enabled]);

  return stamped ? fromPins : fromSnapshot;
}

function sameDayIst(iso: string): boolean {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return false;
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return format.format(at) === format.format(new Date());
}

let hintShownThisPage = false;

function hintSeen(): boolean {
  if (hintShownThisPage) return true;
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function markHintSeen(): void {
  hintShownThisPage = true;
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* Private mode: the hint just shows once per page load. */
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
