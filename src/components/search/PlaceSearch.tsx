"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { bandAccent, bandNumberColor } from "@/lib/aqi";
import type { Band, SearchHit } from "@/lib/types";
import { bandLabel, cityPath, stationPath } from "@/components/reading/text";

const BANDS = new Set<Band>([
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
]);

export function PlaceSearch() {
  const router = useRouter();
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [notice, setNotice] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const option = optionRefs.current[active];
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [active, hits, open]);

  function choose(hit: SearchHit) {
    setOpen(false);
    router.push(hit.kind === "city" ? cityPath(hit.slug) : stationPath(hit.slug));
  }

  async function loadHits(q: string, signal: AbortSignal, request: number) {
    setNotice("Searching.");
    setHits([]);
    setActive(-1);
    setOpen(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal,
        headers: { accept: "application/json" },
      });
      if (signal.aborted || request !== requestRef.current) return;
      if (!response.ok) {
        setHits([]);
        setNotice("Search is unavailable. Try again in a moment.");
        setOpen(true);
        return;
      }
      const data: unknown = await response.json();
      if (signal.aborted || request !== requestRef.current) return;
      const next = parseHits(data);
      setHits(next);
      setActive(-1);
      setOpen(true);
      setNotice(next.length === 0 ? "No city or station matches that." : null);
    } catch (error) {
      if (signal.aborted || request !== requestRef.current || isAbortError(error)) return;
      setHits([]);
      setOpen(true);
      setNotice("Search is unavailable. Try again in a moment.");
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const request = ++requestRef.current;
    const q = value.trim();
    if (!q) {
      setHits([]);
      setOpen(false);
      setActive(-1);
      setNotice(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      void loadHits(q, controller.signal, request);
    }, 200);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (hits.length === 0) return;
      setOpen(true);
      setActive((current) => (current + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (hits.length === 0) return;
      setOpen(true);
      setActive((current) => (current <= 0 ? hits.length - 1 : current - 1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || active < 0) return;
    const hit = hits[active];
    if (hit) choose(hit);
  }

  function onLocate() {
    setLocationNote(null);
    setOpen(false);
    if (!("geolocation" in navigator)) {
      setLocationNote(
        "This browser cannot share a location, so search for a city or station instead.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        setLocating(false);
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        router.push(`/near?lat=${lat}&lon=${lon}`);
      },
      (error) => {
        if (!mounted.current) return;
        setLocating(false);
        setLocationNote(
          error.code === error.PERMISSION_DENIED
            ? "Location was denied, so search for a city or station instead."
            : "Location could not be read, so search for a city or station instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const live =
    notice ??
    (open && hits.length > 0
      ? `${hits.length} ${hits.length === 1 ? "match" : "matches"}`
      : "");
  const activeId = active >= 0 ? `${baseId}-opt-${active}` : undefined;

  return (
    <div className="search-block">
      <form
        role="search"
        onSubmit={onSubmit}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setOpen(false);
        }}
      >
        <label className="search-label" htmlFor={inputId}>
          City or station
        </label>
        <div className="search-field-wrap">
          <input
            id={inputId}
            className="search-field"
            role="combobox"
            type="text"
            value={query}
            placeholder="Delhi, Sirifort, Bengaluru"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open ? activeId : undefined}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (hits.length > 0 || notice) setOpen(true);
            }}
          />
          <div
            id={listId}
            ref={listRef}
            role={hits.length > 0 ? "listbox" : undefined}
            aria-label={hits.length > 0 ? "Matching cities and stations" : undefined}
            hidden={!open}
            className="search-panel"
          >
            {hits.length > 0
              ? hits.map((hit, index) => {
                  const selected = index === active;
                  return (
                    <a
                      key={`${hit.kind}-${hit.slug}-${index}`}
                      id={`${baseId}-opt-${index}`}
                      href={hit.kind === "city" ? cityPath(hit.slug) : stationPath(hit.slug)}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      role="option"
                      aria-selected={selected}
                      className={selected ? "search-option is-active" : "search-option"}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.preventDefault();
                        choose(hit);
                      }}
                    >
                      <span>
                        <span className="search-option-label">{hit.label}</span>
                        {hit.detail ? (
                          <span className="search-option-detail">{hit.detail}</span>
                        ) : null}
                      </span>
                      <span className="row-aqi">
                        <span
                          className="band-word"
                          style={{ color: bandAccent(hit.band) }}
                        >
                          {bandLabel(hit.band)}
                        </span>
                        <span
                          className="row-value"
                          style={{ color: bandNumberColor(hit.band) }}
                        >
                          {hit.aqi ?? "—"}
                        </span>
                      </span>
                    </a>
                  );
                })
              : notice
                ? <p className="search-empty">{notice}</p>
                : null}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
        {locationNote ? <p className="field-note">{locationNote}</p> : null}
      </form>
      <button
        type="button"
        className="location-button"
        onClick={onLocate}
        disabled={locating}
        aria-busy={locating}
      >
        Use my location
      </button>
    </div>
  );
}

function parseHits(data: unknown): SearchHit[] {
  return extractRows(data).flatMap((row) => {
    const hit = asHit(row);
    return hit ? [hit] : [];
  });
}

function extractRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as { hits?: unknown; results?: unknown };
  if (Array.isArray(record.hits)) return record.hits;
  if (Array.isArray(record.results)) return record.results;
  return [];
}

function asHit(value: unknown): SearchHit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.kind !== "city" && row.kind !== "station") return null;
  if (typeof row.slug !== "string" || row.slug.length === 0) return null;
  if (typeof row.label !== "string") return null;
  const detail = typeof row.detail === "string" ? row.detail : "";
  const aqi = typeof row.aqi === "number" && Number.isFinite(row.aqi) ? row.aqi : null;
  const band = typeof row.band === "string" && BANDS.has(row.band as Band) ? (row.band as Band) : null;
  return { kind: row.kind, slug: row.slug, label: row.label, detail, aqi, band };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
