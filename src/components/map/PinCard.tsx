"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { bandAccent, bandNumberColor, bandTextColor } from "@/lib/aqi";
import { safeMapHref, type MapPin } from "./pins";

type Point = { date: string; aqi: number; t: number };
type Series = { official: Point[]; model: Point[] };
type Marked = Point & { kind: "official" | "estimate"; x: number; y: number };

const HEIGHT = 52;
const PAD_X = 7;
const PAD_Y = 8;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The card that opens when a dot is chosen: the value, the band, a trend. */
export function PinCard({ pin, onClose }: { pin: MapPin; onClose: () => void }) {
  const href = safeMapHref(pin.href);
  const accent = bandAccent(pin.band);

  return (
    <div className="pin-card" role="dialog" aria-label={`${pin.name}, details`}>
      <div className="pin-card-head">
        <div className="pin-card-title">
          <p className="pin-card-name">{pin.name}</p>
          {pin.place ? <p className="pin-card-place">{pin.place}</p> : null}
        </div>
        <button type="button" className="pin-card-close" onClick={onClose} aria-label="Close details">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3.5 3.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="pin-card-row">
        <p className="pin-card-value">
          <span className="pin-card-number" style={{ color: bandNumberColor(pin.band) }}>
            {pin.aqi ?? "–"}
          </span>
          <span className="pin-card-band" style={{ color: bandTextColor(pin.band) }}>
            {pin.band ?? "No AQI"}
          </span>
        </p>
        {href ? (
          <Link className="pin-card-open" href={href}>
            Open
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : null}
      </div>
      <PinSpark pin={pin} accent={accent} />
    </div>
  );
}

type Loaded = { key: string; at: number } & Series;
const CACHE = new Map<string, Loaded>();
const FRESH_MS = 5 * 60 * 1000;

function PinSpark({ pin, accent }: { pin: MapPin; accent: string }) {
  const key = `${pin.kind}:${pin.slug}`;
  const [loaded, setLoaded] = useState<Loaded | null>(() => {
    const hit = CACHE.get(key);
    return hit && Date.now() - hit.at < FRESH_MS ? hit : null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ kind: pin.kind, slug: pin.slug, range: "1m" });
    fetch(`/api/trend?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const data: unknown = await response.json();
        if (!active) return;
        const next: Loaded = {
          key,
          at: Date.now(),
          official: readSeries(data, "official"),
          model: readSeries(data, "model"),
        };
        CACHE.set(key, next);
        setLoaded(next);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbort(error)) return;
        setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, loaded, pin.kind, pin.slug]);

  if (failed) return <p className="pin-spark-note">The trend is not available right now.</p>;
  if (!loaded) {
    return (
      <div className="pin-spark" aria-hidden="true">
        <div className="pin-spark-skeleton" />
      </div>
    );
  }
  return <Scrubber series={loaded} pin={pin} accent={accent} />;
}

function Scrubber({ series, pin, accent }: { series: Series; pin: MapPin; accent: string }) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(240);
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(120, node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The official series ends with the number on the card when the station
  // published today, so the line always meets the dot above it.
  const official = useMemo(() => {
    const day = stampDay(pin.updatedAt);
    if (pin.aqi == null || !day || series.official.some((point) => point.date === day)) {
      return series.official;
    }
    const t = Date.parse(day);
    if (!Number.isFinite(t)) return series.official;
    return [...series.official, { date: day, aqi: pin.aqi, t }];
  }, [series.official, pin.aqi, pin.updatedAt]);

  const placed = useMemo(() => {
    const all = [...official, ...series.model];
    if (all.length < 2) return null;
    const times = all.map((point) => point.t);
    const values = all.map((point) => point.aqi);
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const spanT = t1 - t0 || 1;
    const spanV = hi - lo || 1;
    const place = (point: Point, kind: Marked["kind"]): Marked => ({
      ...point,
      kind,
      x: PAD_X + ((point.t - t0) / spanT) * (width - PAD_X * 2),
      y: PAD_Y + (1 - (point.aqi - lo) / spanV) * (HEIGHT - PAD_Y * 2),
    });
    const o = official.map((point) => place(point, "official"));
    const m = series.model.map((point) => place(point, "estimate"));
    const ordered = [...o, ...m].sort((a, b) => a.t - b.t || (a.kind === "official" ? -1 : 1));
    return { official: o, model: m, ordered };
  }, [official, series.model, width]);

  if (!placed) {
    return <p className="pin-spark-note">The trend builds up as readings arrive.</p>;
  }

  const latest =
    placed.official[placed.official.length - 1] ?? placed.model[placed.model.length - 1];
  const shown = cursor != null ? (placed.ordered[cursor] ?? latest) : latest;

  const nearest = (clientX: number): number => {
    const node = plotRef.current;
    if (!node) return 0;
    const box = node.getBoundingClientRect();
    const x = ((clientX - box.left) / (box.width || 1)) * width;
    let best = 0;
    let gap = Number.POSITIVE_INFINITY;
    placed.ordered.forEach((point, index) => {
      const d = Math.abs(point.x - x);
      if (d < gap - 0.5) {
        gap = d;
        best = index;
      }
    });
    return best;
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => setCursor(nearest(event.clientX));
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = placed.ordered.length - 1;
    const at = cursor ?? last;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = Math.max(0, at - 1);
    else if (event.key === "ArrowRight") next = Math.min(last, at + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next == null) return;
    event.preventDefault();
    setCursor(next);
  };

  const hasBoth = placed.official.length > 0 && placed.model.length > 0;
  const onlyEstimate = placed.official.length === 0;

  return (
    <div className="pin-spark" style={{ ["--spark" as string]: accent }}>
      <div className="pin-spark-top">
        <p className="pin-spark-read" aria-live="polite">
          <span className="pin-spark-num">{Math.round(shown.aqi)}</span>
          <span className={`pin-spark-tag is-${shown.kind}`}>
            {shown.kind === "official" ? "Official" : "Estimate"}
          </span>
          <span className="pin-spark-date">{formatDay(shown.date)}</span>
        </p>
        <p className="pin-spark-key" aria-hidden="true">
          {onlyEstimate ? null : (
            <span>
              <i className="key-official" />
              Official
            </span>
          )}
          {hasBoth || onlyEstimate ? (
            <span>
              <i className="key-estimate" />
              Estimate
            </span>
          ) : null}
        </p>
      </div>
      <div
        ref={plotRef}
        className="pin-spark-plot"
        tabIndex={0}
        role="group"
        aria-label="Trend over the last 30 days. Use the left and right arrow keys to step through days."
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setCursor(null);
        }}
        onBlur={() => setCursor(null)}
        onKeyDown={onKey}
      >
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} aria-hidden="true">
          {placed.model.length > 1 ? (
            <path className="spark-estimate-line" d={line(placed.model)} fill="none" />
          ) : null}
          {placed.model.map((point) => (
            <circle key={`e-${point.date}`} className="spark-estimate-dot" cx={point.x} cy={point.y} r="1.9" />
          ))}
          {placed.official.length > 1 ? (
            <path className="spark-official-line" d={line(placed.official)} fill="none" />
          ) : null}
          {placed.official.map((point, index) => (
            <circle
              key={`o-${point.date}`}
              className="spark-official-dot"
              cx={point.x}
              cy={point.y}
              r={index === placed.official.length - 1 ? 4 : 2}
            />
          ))}
          {cursor != null ? (
            <g>
              <line className="spark-guide" x1={shown.x} x2={shown.x} y1="2" y2={HEIGHT - 2} />
              <circle
                className={shown.kind === "official" ? "spark-pick-official" : "spark-pick-estimate"}
                cx={shown.x}
                cy={shown.y}
                r="4.5"
              />
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

function line(points: Marked[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function readSeries(data: unknown, key: "official" | "model"): Point[] {
  if (!data || typeof data !== "object") return [];
  const rows = (data as Record<string, unknown>)[key];
  if (!Array.isArray(rows)) return [];
  const points: Point[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const date = (row as { date?: unknown }).date;
    const aqi = (row as { aqi?: unknown }).aqi;
    if (typeof date !== "string" || typeof aqi !== "number" || !Number.isFinite(aqi)) continue;
    const t = Date.parse(date);
    if (!Number.isFinite(t)) continue;
    points.push({ date, aqi, t });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

/** "18-11-2026 14:00:00" to "2026-11-18". */
function stampDay(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function formatDay(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month}` : date;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
