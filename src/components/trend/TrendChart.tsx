"use client";

import { useEffect, useId, useRef, useState } from "react";

type Range = "1m" | "6m";
type Status = "loading" | "ready" | "empty" | "error";
type Point = { date: string; aqi: number; t: number };

const VW = 640;
const VH = 240;
const PAD_L = 8;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 14;
const LEVELS = [50, 100, 200, 300, 400];

export function TrendChart({
  kind,
  slug,
  accent,
}: {
  kind: "city" | "station";
  slug: string;
  accent: string;
}) {
  const labelId = useId();
  const [range, setRange] = useState<Range>("1m");
  const [status, setStatus] = useState<Status>("loading");
  const [official, setOfficial] = useState<Point[]>([]);
  const [model, setModel] = useState<Point[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dotRadius, setDotRadius] = useState(2.5);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus("loading");
    const params = new URLSearchParams({ kind, slug, range });
    fetch(`/api/trend?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setOfficial([]);
          setModel([]);
          setStatus("error");
          return;
        }
        const data: unknown = await response.json();
        if (!active) return;
        const nextOfficial = readSeries(data, "official");
        const nextModel = readSeries(data, "model");
        setOfficial(nextOfficial);
        setModel(nextModel);
        setStatus(nextOfficial.length === 0 && nextModel.length === 0 ? "empty" : "ready");
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbort(error)) return;
        setStatus("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, slug, range]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const width = svg.getBoundingClientRect().width;
      setDotRadius(width > 0 ? (5 * VW) / width : 5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [status, official, model, range]);

  const placed = status === "ready" ? layout(official, model) : null;
  const labels = placed ? axisLabels(placed.official, placed.model) : null;

  return (
    <section className="trend-card" aria-busy={status === "loading" || undefined}>
      <div className="trend-switch" role="group" aria-label="Trend range">
        <button
          type="button"
          aria-pressed={range === "1m"}
          onClick={() => setRange("1m")}
        >
          1 month
        </button>
        <button
          type="button"
          aria-pressed={range === "6m"}
          onClick={() => setRange("6m")}
        >
          6 months
        </button>
      </div>
      {status === "loading" ? (
        <div className="trend-skeleton" aria-hidden="true">
          <span className="sr-only">Loading the trend.</span>
        </div>
      ) : null}
      {status === "ready" && placed ? (
        <>
        <div className="trend-plot">
          <div className="trend-ylabels" aria-hidden="true">
            {LEVELS.map((level) => (
              <span key={level} style={{ top: `${(yOf(level) / VH) * 100}%` }}>
                {level}
              </span>
            ))}
          </div>
          <div className="trend-canvas">
          <svg
            ref={svgRef}
            className="trend-chart"
            viewBox={`0 0 ${VW} ${VH}`}
            role="img"
            aria-labelledby={labelId}
          >
            <title id={labelId}>{chartLabel(range, official, model)}</title>
            {LEVELS.map((level) => {
              const y = yOf(level);
              return (
                <line
                  key={level}
                  x1={PAD_L}
                  x2={VW - PAD_R}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="trend-grid"
                />
              );
            })}
            {placed.model.length > 1 ? (
              <path d={areaPath(placed.model)} fill={accent} fillOpacity="0.14" stroke="none" />
            ) : null}
            {placed.model.length > 1 ? (
              <path
                d={linePath(placed.model)}
                fill="none"
                stroke={accent}
                strokeWidth="1.75"
                className="trend-model"
                pathLength={1}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {placed.model.map((point) => (
              <circle
                key={`model-${point.date}`}
                cx={point.x}
                cy={point.y}
                r={dotRadius * 0.72}
                fill={accent}
              >
                <title>{`Model ${Math.round(point.aqi)} on ${formatDay(point.date)}. Not the government number.`}</title>
              </circle>
            ))}
            {placed.official.length > 1 ? (
              <path
                d={linePath(placed.official)}
                fill="none"
                stroke="currentColor"
                className="trend-official"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {placed.official.map((point, index) => {
              const latest = index === placed.official.length - 1;
              const radius = latest ? dotRadius * 1.45 : dotRadius;
              return (
                <g key={point.date}>
                  {latest ? (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius * 2.1}
                      className="trend-live-ring"
                      fill="currentColor"
                    />
                  ) : null}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    className="trend-dot"
                    stroke="var(--card)"
                    strokeWidth="2"
                  >
                    <title>{`Official ${Math.round(point.aqi)} on ${formatDay(point.date)}`}</title>
                  </circle>
                </g>
              );
            })}
          </svg>
          </div>
        </div>
        {labels ? (
          <div className="trend-xlabels" aria-hidden="true">
            <span>{labels.start}</span>
            <span>{labels.end}</span>
          </div>
        ) : null}
        </>
      ) : null}
      {status === "ready" ? (
        <div className="trend-legend">
          <span className="trend-key">
            <span className="trend-key-model" style={{ background: accent }} />
            Model day
          </span>
          <span className="trend-key">
            <span className="trend-key-official" />
            Official
          </span>
        </div>
      ) : null}
      {status === "empty" || status === "error" ? (
        <p className="trend-empty">The trend has not arrived yet.</p>
      ) : null}
      <p className="trend-caption">
        Each small dot is a model day, not the government number. The larger dot is the official CPCB reading.
      </p>
    </section>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return date;
  return `${Number(match[3])} ${month}`;
}

function axisLabels(
  official: Placed[],
  model: Placed[],
): { start: string; end: string } | null {
  const points = [...official, ...model];
  if (points.length === 0) return null;
  let start = points[0];
  let end = points[0];
  for (const point of points) {
    if (point.t < start.t) start = point;
    if (point.t > end.t) end = point;
  }
  return { start: formatDay(start.date), end: formatDay(end.date) };
}

function chartLabel(range: Range, official: Point[], model: Point[]): string {
  const span = range === "1m" ? "1 month" : "6 months";
  const latest = official[official.length - 1];
  const officialText = latest
    ? `Latest official reading ${Math.round(latest.aqi)} on ${latest.date}.`
    : "No official points in this range.";
  const modelText =
    model.length > 0
      ? "A model line shows earlier months and is not the government number."
      : "No model line.";
  return `Trend for ${span}. ${officialText} ${modelText}`;
}

type Placed = Point & { x: number; y: number };

function layout(official: Point[], model: Point[]): { official: Placed[]; model: Placed[] } {
  const times = [...official, ...model].map((point) => point.t);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const place = (points: Point[]) =>
    points.map((point) => ({
      ...point,
      x: round(xOf(point.t, min, max)),
      y: round(yOf(point.aqi)),
    }));
  return { official: place(official), model: place(model) };
}

function yOf(aqi: number): number {
  const value = Math.min(500, Math.max(0, aqi));
  const plotH = VH - PAD_T - PAD_B;
  return PAD_T + ((500 - value) / 500) * plotH;
}

function xOf(t: number, min: number, max: number): number {
  const plotW = VW - PAD_L - PAD_R;
  if (!(max > min)) return PAD_L + plotW / 2;
  return PAD_L + ((t - min) / (max - min)) * plotW;
}

function areaPath(points: Placed[]): string {
  const base = round(yOf(0));
  const first = points[0];
  const last = points[points.length - 1];
  let path = `M ${first.x} ${base} L ${first.x} ${first.y}`;
  for (const point of points.slice(1)) path += ` L ${point.x} ${point.y}`;
  path += ` L ${last.x} ${base} Z`;
  return path;
}

function linePath(points: Placed[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
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
    if (typeof date !== "string" || date.length === 0) continue;
    if (typeof aqi !== "number" || !Number.isFinite(aqi)) continue;
    const t = Date.parse(date);
    if (!Number.isFinite(t)) continue;
    points.push({ date, aqi, t });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
