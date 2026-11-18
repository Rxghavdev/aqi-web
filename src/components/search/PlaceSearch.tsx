"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/types";
import { AqiChip } from "./AqiChip";
import { FOCUS_SEARCH_EVENTS } from "./events";
import { hitPath } from "./hits";
import { pushRecent } from "./recent";
import { useLocate } from "./useLocate";
import { usePlaceSearch } from "./usePlaceSearch";

/** Inline search with the results panel. Used in the home hero and on /near. */
export function PlaceSearch() {
  const router = useRouter();
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const { query, setQuery, hits, status } = usePlaceSearch();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { locate, locating, note: locationNote } = useLocate();
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    function focusSearch() {
      inputRef.current?.focus();
    }
    for (const name of FOCUS_SEARCH_EVENTS) window.addEventListener(name, focusSearch);
    return () => {
      for (const name of FOCUS_SEARCH_EVENTS) window.removeEventListener(name, focusSearch);
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

  const notice =
    status === "loading"
      ? "Searching."
      : status === "empty"
        ? "No city or station matches that."
        : status === "error"
          ? "Search is unavailable. Try again in a moment."
          : null;

  function choose(hit: SearchHit) {
    setOpen(false);
    pushRecent(hit);
    router.push(hitPath(hit));
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setActive(-1);
    setOpen(value.trim().length > 0);
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
    if (!open || hits.length === 0) return;
    const hit = hits[active >= 0 ? active : 0];
    if (hit) choose(hit);
  }

  const showHits = open && hits.length > 0;
  const showNotice = open && hits.length === 0 && notice != null;
  const live =
    notice ?? (showHits ? `${hits.length} ${hits.length === 1 ? "match" : "matches"}` : "");
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
            ref={inputRef}
            id={inputId}
            className="search-field"
            data-hero-search=""
            role="combobox"
            type="text"
            value={query}
            placeholder="Delhi, Sirifort, Bengaluru"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-expanded={showHits || showNotice}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showHits ? activeId : undefined}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (query.trim()) setOpen(true);
            }}
          />
          <div
            id={listId}
            ref={listRef}
            role={hits.length > 0 ? "listbox" : undefined}
            aria-label={hits.length > 0 ? "Matching cities and stations" : undefined}
            hidden={!(showHits || showNotice)}
            className="search-panel"
          >
            {showHits
              ? hits.map((hit, index) => {
                  const selected = index === active;
                  return (
                    <a
                      key={`${hit.kind}-${hit.slug}-${index}`}
                      id={`${baseId}-opt-${index}`}
                      href={hitPath(hit)}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      role="option"
                      aria-selected={selected}
                      className={selected ? "search-option is-active" : "search-option"}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        choose(hit);
                      }}
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
                      <AqiChip aqi={hit.aqi} band={hit.band} />
                    </a>
                  );
                })
              : showNotice
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
        onClick={locate}
        disabled={locating}
        aria-busy={locating}
      >
        Use my location
      </button>
    </div>
  );
}
