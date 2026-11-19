"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/types";
import { AqiChip } from "./AqiChip";
import { hitPath } from "./hits";
import {
  ClockIcon,
  CloseIcon,
  LocateIcon,
  PinIcon,
  SearchIcon,
  StationIcon,
} from "./icons";
import { clearRecent, pushRecent, readRecent, type RecentPlace } from "./recent";
import { useLocate } from "./useLocate";
import { usePlaceSearch } from "./usePlaceSearch";

type Item = {
  key: string;
  place: RecentPlace;
  aqi: number | null;
  band: SearchHit["band"];
  recent: boolean;
};

const FOCUSABLE =
  'button:not([disabled]), a[href]:not([tabindex="-1"]), input:not([disabled])';

export function SearchPalette({
  phase,
  onClose,
}: {
  phase: "open" | "closing";
  /** `restore: false` skips returning focus, used when navigating away. */
  onClose: (options?: { restore?: boolean }) => void;
}) {
  const router = useRouter();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listId = `${baseId}-list`;
  const { query, setQuery, hits, status } = usePlaceSearch();
  const [recent, setRecent] = useState<RecentPlace[]>(() => readRecent());
  const [activeIndex, setActiveIndex] = useState(-1);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { locate, locating, note } = useLocate(() => onClose({ restore: false }));

  const typed = query.trim().length > 0;
  const items: Item[] = useMemo(() => {
    if (typed) {
      return hits.map((hit) => ({
        key: `${hit.kind}:${hit.slug}`,
        place: hit,
        aqi: hit.aqi,
        band: hit.band,
        recent: false,
      }));
    }
    return recent.map((place) => ({
      key: `${place.kind}:${place.slug}`,
      place,
      aqi: null,
      band: null,
      recent: true,
    }));
  }, [typed, hits, recent]);

  const active = items.length === 0 ? -1 : Math.min(activeIndex, items.length - 1);
  const showResults = typed && items.length > 0;
  const showRecent = !typed && items.length > 0;
  const loading = typed && status === "loading" && items.length === 0;
  const noMatch = typed && status === "empty";
  const failed = typed && status === "error";
  const listVisible = showResults || showRecent;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    // Hiding the scrollbar would nudge the page sideways, so its width is kept.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, []);

  useEffect(() => {
    if (active < 0) return;
    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(item: Item) {
    pushRecent(item.place);
    onClose({ restore: false });
    router.push(hitPath(item.place));
  }

  function onInputChange(value: string) {
    setQuery(value);
    setActiveIndex(value.trim() ? 0 : -1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      const nodes = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((node) => node.offsetParent !== null || node === document.activeElement);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !dialogRef.current?.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.target !== inputRef.current) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const from = Math.min(current, items.length - 1);
        if (from < 0) return step === 1 ? 0 : items.length - 1;
        return (from + step + items.length) % items.length;
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active >= 0 ? active : typed ? 0 : -1];
      if (item) choose(item);
    }
  }

  function onOptionClick(event: MouseEvent<HTMLAnchorElement>, item: Item) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    choose(item);
  }

  const live = loading
    ? "Searching."
    : noMatch
      ? "No city or station matches that."
      : failed
        ? "Search is unavailable."
        : showResults
          ? `${items.length} ${items.length === 1 ? "match" : "matches"}`
          : "";

  return (
    <div className="palette-root" data-state={phase}>
      <div className="palette-backdrop" onMouseDown={() => onClose()} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="sr-only">
          Search cities and stations
        </h2>
        <div className="palette-bar">
          <SearchIcon className="palette-lens" width={20} height={20} />
          <input
            ref={inputRef}
            className="palette-input"
            role="combobox"
            type="text"
            value={query}
            placeholder="Search city or station"
            aria-label="City or station"
            aria-expanded={listVisible}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={listVisible && active >= 0 ? `${baseId}-opt-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            onChange={(event) => onInputChange(event.target.value)}
          />
          <button
            type="button"
            className="palette-close"
            onClick={() => onClose()}
            aria-label="Close search"
          >
            <CloseIcon className="palette-close-icon" width={20} height={20} />
            <kbd className="palette-close-key" aria-hidden="true">
              Esc
            </kbd>
          </button>
        </div>

        <div className="palette-body" ref={listRef}>
          {showRecent ? (
            <div className="palette-head">
              <span className="palette-label">Recent</span>
              <button
                type="button"
                className="palette-clear"
                onClick={() => {
                  clearRecent();
                  setRecent([]);
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                }}
              >
                Clear
              </button>
            </div>
          ) : null}
          {showResults ? <p className="palette-label palette-label-pad">Results</p> : null}

          {listVisible ? (
            <div
              id={listId}
              role="listbox"
              aria-label={showRecent ? "Recent searches" : "Matching cities and stations"}
              className="palette-list"
            >
              {items.map((item, index) => {
                const selected = index === active;
                const Icon = item.recent
                  ? ClockIcon
                  : item.place.kind === "city"
                    ? PinIcon
                    : StationIcon;
                return (
                  <a
                    key={item.key}
                    id={`${baseId}-opt-${index}`}
                    data-index={index}
                    href={hitPath(item.place)}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    className={selected ? "palette-option is-active" : "palette-option"}
                    onMouseMove={() => {
                      if (!selected) setActiveIndex(index);
                    }}
                    onClick={(event) => onOptionClick(event, item)}
                  >
                    <span className="palette-option-icon">
                      <Icon width={18} height={18} />
                    </span>
                    <span className="palette-option-text">
                      <span className="palette-option-label">{item.place.label}</span>
                      <span className="palette-option-detail">
                        {item.place.kind === "city" ? "City" : "Station"}
                        {item.place.detail ? ` · ${item.place.detail}` : ""}
                      </span>
                    </span>
                    {item.recent ? null : <AqiChip aqi={item.aqi} band={item.band} />}
                  </a>
                );
              })}
            </div>
          ) : loading ? (
            <div className="palette-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="palette-state">
              <SearchIcon className="palette-state-icon" width={26} height={26} />
              {noMatch ? (
                <>
                  <p className="palette-state-title">No city or station matches that</p>
                  <p className="palette-state-body">Check the spelling, or try a nearby city.</p>
                </>
              ) : failed ? (
                <>
                  <p className="palette-state-title">Search is unavailable</p>
                  <p className="palette-state-body">Try again in a moment.</p>
                </>
              ) : (
                <>
                  <p className="palette-state-title">Start typing a city or station</p>
                  <p className="palette-state-body">For example, Delhi or Sirifort.</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="palette-foot">
          <button
            type="button"
            className="palette-locate"
            onClick={locate}
            disabled={locating}
            aria-busy={locating}
          >
            <LocateIcon width={18} height={18} />
            <span>{locating ? "Finding your location" : "Use my location"}</span>
          </button>
          <p className="palette-keys" aria-hidden="true">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>to move</span>
            <kbd>↵</kbd>
            <span>to open</span>
          </p>
        </div>
        {note ? <p className="palette-note">{note}</p> : null}
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
      </div>
    </div>
  );
}
