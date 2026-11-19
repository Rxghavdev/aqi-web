"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { bandAccent, bandFor, bandNumberColor, bandTextColor } from "@/lib/aqi";
import { bandLabel, cityPath } from "@/components/reading/text";
import type { StateGroup } from "./group";

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Every city, grouped by state, with an instant in-page filter. All rows are in
 * the server HTML; filtering only hides rows, so there is no network call and
 * the toolbar never moves.
 */
export function CitiesBrowser({ groups }: { groups: StateGroup[] }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const needle = fold(query.trim());

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.cities.length, 0),
    [groups],
  );

  const visible = useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((group) => {
        const stateHit = fold(group.state).includes(needle);
        const cities = stateHit
          ? group.cities
          : group.cities.filter((city) => fold(city.name).includes(needle));
        return { ...group, cities };
      })
      .filter((group) => group.cities.length > 0);
  }, [groups, needle]);

  const shown = visible.reduce((sum, group) => sum + group.cities.length, 0);
  const liveIds = new Set(visible.map((group) => group.id));
  const status = needle ? `${shown} of ${total} cities` : `${total} cities`;

  return (
    <div className="cities">
      <div className="cities-tools">
        <div className="cities-filter">
          <label htmlFor={inputId} className="sr-only">
            Filter cities
          </label>
          <svg
            className="cities-filter-icon"
            aria-hidden="true"
            focusable="false"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={inputId}
            className="cities-input"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Filter cities or states"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
          />
          <button
            type="button"
            className="cities-clear"
            aria-label="Clear filter"
            hidden={query === ""}
            onClick={() => setQuery("")}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="cities-count" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <nav className="cities-jump" aria-label="Jump to a state">
        <ul>
          {groups.map((group) => {
            const live = liveIds.has(group.id);
            return (
              <li key={group.id}>
                <a
                  href={`#${group.id}`}
                  className={live ? "cities-jump-chip" : "cities-jump-chip is-off"}
                  aria-disabled={live ? undefined : true}
                  tabIndex={live ? undefined : -1}
                >
                  {group.state}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="cities-results">
        {visible.map((group) => (
          <section
            key={group.id}
            id={group.id}
            className="cities-state"
            aria-labelledby={`${group.id}-title`}
          >
            <h2 id={`${group.id}-title`} className="cities-state-title">
              {group.state}
              <span className="cities-state-count">{group.cities.length}</span>
            </h2>
            <ul className="cities-list">
              {group.cities.map((city) => (
                <li key={city.slug}>
                  <CityLink city={city} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {visible.length === 0 ? (
          <div className="cities-empty" role="status">
            <p className="cities-empty-title">No city matches &ldquo;{query.trim()}&rdquo;.</p>
            <p className="cities-empty-body">
              Check the spelling, or search for a station on the home page.
            </p>
            <div className="cities-empty-actions">
              <button type="button" className="cities-empty-button" onClick={() => setQuery("")}>
                Clear filter
              </button>
              <Link href="/" className="cities-empty-link">
                Go to search
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CityLink({ city }: { city: StateGroup["cities"][number] }) {
  const band = bandFor(city.aqi);
  const style =
    city.aqi == null
      ? undefined
      : ({
          "--accent": bandAccent(band),
          "--band-num": bandNumberColor(band),
          "--band-text": bandTextColor(band),
        } as CSSProperties);
  const stations =
    city.total === 1 ? "1 station" : `${city.total} stations`;
  return (
    <Link href={cityPath(city.slug)} className="cities-row" style={style}>
      <span className="cities-row-main">
        <span className="cities-row-name">{city.name}</span>
        <span className="cities-row-meta">{stations}</span>
      </span>
      <span className="cities-row-end">
        <span className="cities-row-band">
          {city.aqi == null ? "No AQI" : bandLabel(band)}
        </span>
        <span className={city.aqi == null ? "cities-chip is-empty" : "cities-chip"}>
          <span className="sr-only">AQI </span>
          {city.aqi ?? "—"}
        </span>
      </span>
    </Link>
  );
}
