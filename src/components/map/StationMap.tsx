"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { bandAccent } from "@/lib/aqi";
import type { Band } from "@/lib/types";
import { readTheme, type ThemeName } from "@/components/shell/theme";
import { cityPins, safeMapHref, type MapPin } from "./pins";
import "maplibre-gl/dist/maplibre-gl.css";

const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/positron";
const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

/**
 * Dot geometry is fixed in screen pixels, not scaled by zoom.
 * A three-digit index at this size always clears the rim.
 */
const DOT_RADIUS = 17;
const DOT_LABEL_SIZE = 10;

type Point = { lat: number; lon: number };

type MapFrame = {
  pins: MapPin[];
  activeSlug: string | null;
  user: Point | null;
  fitKey: string;
};

export function StationMap({
  pins,
  activeSlug = null,
  user = null,
  hereLabel = "Here",
  frame = "stage-map",
}: {
  pins: MapPin[];
  activeSlug?: string | null;
  user?: Point | null;
  hereLabel?: string;
  frame?: string;
}) {
  const hereKey = `${activeSlug ?? ""}:${pins.length}:${pins[0]?.slug ?? ""}:${pins.at(-1)?.slug ?? ""}`;
  const [scope, setScope] = useState<"here" | "india">(pins.length > 0 ? "here" : "india");
  const [indiaPins, setIndiaPins] = useState<MapPin[] | null>(null);
  const [indiaError, setIndiaError] = useState(false);
  const [selected, setSelected] = useState<MapPin | null>(null);

  useEffect(() => {
    setScope(pins.length > 0 ? "here" : "india");
    setSelected(null);
  }, [hereKey, pins.length]);

  useEffect(() => {
    if (scope !== "india" || indiaPins) return;
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
  }, [scope, indiaPins]);

  const shown = scope === "here" ? pins : (indiaPins ?? []);
  const framed = useMemo<MapFrame>(
    () => ({
      pins: shown,
      activeSlug: scope === "here" ? activeSlug : null,
      user,
      fitKey: `${scope}:${shown.map((pin) => pin.slug).join("|")}:${user ? `${user.lat.toFixed(3)},${user.lon.toFixed(3)}` : ""}`,
    }),
    [shown, scope, activeSlug, user],
  );

  const caption =
    scope === "india"
      ? indiaError
        ? "City averages did not load."
        : indiaPins
          ? "Each dot is a city average, from CPCB monitors."
          : "Placing city averages."
      : "Each dot is a CPCB monitor. A dark count groups nearby monitors; tap to open.";

  return (
    <section className={`${frame} map-frame`} aria-label="Map of official readings">
      <MapCanvas frame={framed} onSelect={setSelected} />
      <div className="map-overlay">
        <div className="map-card">
          <p className="map-kicker">Official CPCB</p>
          <p className="map-caption">{caption}</p>
          <ul className="map-legend">
            <Legend swatch="#1f8a4c" label="Good" />
            <Legend swatch="#65a30d" label="Satisfactory" />
            <Legend swatch="#ca8a04" label="Moderate" />
            <Legend swatch="#ea580c" label="Poor" />
            <Legend swatch="#e11d48" label="Very Poor" />
            <Legend swatch="#be123c" label="Severe" />
          </ul>
        </div>
      </div>

      {selected ? (
        <PinCard pin={selected} onClose={() => setSelected(null)} />
      ) : null}

      {pins.length > 0 ? (
        <div className="map-scope" role="group" aria-label="Map extent">
          <button
            type="button"
            aria-pressed={scope === "here"}
            onClick={() => {
              setScope("here");
              setSelected(null);
            }}
          >
            {hereLabel}
          </button>
          <button
            type="button"
            aria-pressed={scope === "india"}
            onClick={() => {
              setScope("india");
              setSelected(null);
            }}
          >
            India
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li>
      <span className="map-swatch" style={{ background: swatch }} />
      {label}
    </li>
  );
}

/** The card that opens when a dot is chosen: the value, the band, a trend. */
function PinCard({ pin, onClose }: { pin: MapPin; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const href = safeMapHref(pin.href);

  return (
    <div className="pin-card" role="dialog" aria-label={`${pin.name} reading`}>
      <div className="pin-card-head">
        <div>
          <p className="pin-card-name">{pin.name}</p>
          {pin.place ? <p className="pin-card-place">{pin.place}</p> : null}
        </div>
        <button type="button" className="pin-card-close" onClick={onClose} aria-label="Close">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="pin-card-value">
        <span className="pin-card-number" style={{ color: bandAccent(pin.band) }}>
          {pin.aqi ?? "—"}
        </span>
        <span className="pin-card-band">{pin.band ?? "Insufficient data"}</span>
      </div>
      <PinSpark slug={pin.slug} accent={bandAccent(pin.band)} official={pin.aqi} />
      {href ? (
        <button
          type="button"
          className="pin-card-open"
          onClick={() => router.push(href)}
        >
          Open this station
        </button>
      ) : null}
    </div>
  );
}

type Spark = { date: string; aqi: number };

function PinSpark({
  slug,
  accent,
  official,
}: {
  slug: string;
  accent: string;
  official: number | null;
}) {
  const [points, setPoints] = useState<Spark[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setPoints(null);
    setFailed(false);
    fetch(`/api/trend?kind=station&slug=${encodeURIComponent(slug)}&range=1m`, {
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
        setPoints(readSeries(data));
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbort(error)) return;
        setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [slug]);

  if (failed) {
    return <p className="pin-spark-note">No history for this station yet.</p>;
  }
  if (!points) {
    return <div className="pin-spark-skeleton" aria-hidden="true" />;
  }
  if (points.length < 2) {
    return <p className="pin-spark-note">History begins after a few days of readings.</p>;
  }

  const width = 220;
  const height = 44;
  const values = [...points.map((point) => point.aqi)];
  if (official != null) values.push(official);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.aqi - low) / span) * (height - 6) - 3;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="pin-spark">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Last 30 days">
        <path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="pin-spark-note">
        30-day model trend, {low}–{high}. Not the government number.
      </p>    </div>
  );
}

function readSeries(data: unknown): Spark[] {
  if (!data || typeof data !== "object") return [];
  const model = (data as { model?: unknown }).model;
  if (!Array.isArray(model)) return [];
  const points: Spark[] = [];
  for (const row of model) {
    if (!row || typeof row !== "object") continue;
    const date = (row as { date?: unknown }).date;
    const aqi = (row as { aqi?: unknown }).aqi;
    if (typeof date !== "string" || typeof aqi !== "number" || !Number.isFinite(aqi)) {
      continue;
    }
    points.push({ date, aqi });
  }
  return points;
}

function MapCanvas({
  frame,
  onSelect,
}: {
  frame: MapFrame;
  onSelect: (pin: MapPin) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const paintRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelect);
  frameRef.current = frame;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let map: MapLibreMap | null = null;
    let marker: Marker | null = null;
    let markerKey = "";
    let you: Marker | null = null;
    let resize: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;
    let cancelled = false;
    let fitted = "";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void (async () => {
      const maplibregl = await loadMapLibre();
      if (cancelled) return;
      const theme = readTheme();
      Object.assign(node.style, {
        position: "absolute",
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
        width: "100%",
        height: "100%",
      });
      map = new maplibregl.Map({
        container: node,
        style: styleFor(theme),
        center: [80.2, 22.6],
        zoom: 3.7,
        minZoom: 3.2,
        maxZoom: 14.5,
        maxBounds: [
          [50, -2],
          [110, 42],
        ],
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
        fadeDuration: reduced ? 0 : 250,
        locale: {
          "CooperativeGesturesHandler.WindowsHelpText": "Hold Ctrl and scroll to zoom the map.",
          "CooperativeGesturesHandler.MacHelpText": "Hold ⌘ and scroll to zoom the map.",
          "CooperativeGesturesHandler.MobileHelpText": "Use two fingers to move the map.",
        },
      });
      if (cancelled) {
        map.remove();
        map = null;
        return;
      }
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-right",
      );
      map.touchPitch.disable();

      const paint = () => {
        if (!map || !map.isStyleLoaded()) return;
        const current = frameRef.current;
        const data = toCollection(current);
        const source = map.getSource("pins");
        if (source && "setData" in source) {
          (source as GeoJSONSource).setData(data);
          map.setPaintProperty("pins", "circle-stroke-color", strokeFor(readTheme()));
        } else if (!map.getLayer("pins")) {
          // Dense cities overlap at city zoom. Clusters keep every readable dot
          // legible, and zooming in splits them into individual monitors.
          map.addSource("pins", {
            type: "geojson",
            data,
            cluster: true,
            clusterRadius: 44,
            clusterMaxZoom: 12,
          });
          map.addLayer({
            id: "cluster-halo",
            type: "circle",
            source: "pins",
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": ["step", ["get", "point_count"], 23, 8, 27, 20, 31],
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-width": 1.2,
              "circle-stroke-color": strokeFor(readTheme()),
              "circle-opacity": 0.55,
            },
          });
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "pins",
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": ["step", ["get", "point_count"], 18, 8, 22, 20, 26],
              "circle-color": clusterFill(readTheme()),
              "circle-stroke-width": 1.6,
              "circle-stroke-color": strokeFor(readTheme()),
            },
          });
          map.addLayer({
            id: "cluster-labels",
            type: "symbol",
            source: "pins",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
              "text-allow-overlap": true,
            },
            paint: {
              "text-color": "#fffdf8",
            },
          });
          map.addLayer({
            id: "pins",
            type: "circle",
            source: "pins",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "circle-sort-key": ["get", "rank"],
            },
            paint: {
              // Constant in screen pixels so a three-digit label clears the rim.
              "circle-radius": DOT_RADIUS,
              "circle-color": ["get", "color"],
              "circle-opacity": ["case", ["==", ["get", "active"], 1], 0, 1],
              "circle-stroke-width": 1.6,
              "circle-stroke-color": strokeFor(readTheme()),
            },
          });
          map.addLayer({
            id: "pin-labels",
            type: "symbol",
            source: "pins",
            filter: [
              "all",
              ["!", ["has", "point_count"]],
              ["!=", ["get", "label"], ""],
              ["!=", ["get", "active"], 1],
            ],
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Bold"],
              "text-size": DOT_LABEL_SIZE,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "symbol-sort-key": ["get", "rank"],
            },
            paint: {
              "text-color": ["get", "ink"],
              "text-halo-color": ["get", "color"],
              "text-halo-width": 0.2,
            },
          });
        }

        const active = current.pins.find((pin) => pin.slug === current.activeSlug) ?? null;
        const activeKey = active ? `${active.slug}:${active.aqi ?? ""}:${active.band ?? ""}` : "";
        if (active) {
          if (!marker || markerKey !== activeKey) {
            marker?.remove();
            marker = new maplibregl.Marker({
              element: activeMark(active, (href) => {
                const safe = safeMapHref(href);
                if (safe) map?.flyTo({ center: [active.lon, active.lat], zoom: 11 });
              }),
              anchor: "bottom",
            })
              .setLngLat([active.lon, active.lat])
              .addTo(map);
            markerKey = activeKey;
          } else {
            marker.setLngLat([active.lon, active.lat]);
          }
        } else if (marker) {
          marker.remove();
          marker = null;
          markerKey = "";
        }

        if (current.user) {
          if (!you) {
            const dot = document.createElement("div");
            dot.className = "map-you";
            you = new maplibregl.Marker({ element: dot, anchor: "center" })
              .setLngLat([current.user.lon, current.user.lat])
              .addTo(map);
          } else {
            you.setLngLat([current.user.lon, current.user.lat]);
          }
        } else if (you) {
          you.remove();
          you = null;
        }

        if (fitted !== current.fitKey) {
          fitted = current.fitKey;
          fit(map, current, reduced);
        }
      };

      paintRef.current = paint;
      map.on("style.load", paint);
      map.on("click", "pins", (event) => {
        const slug = String(event.features?.[0]?.properties?.slug ?? "");
        const pin = frameRef.current.pins.find((item) => item.slug === slug);
        if (pin) onSelectRef.current(pin);
      });
      map.on("click", "clusters", (event) => {
        const feature = event.features?.[0];
        const clusterId = Number(feature?.properties?.cluster_id);
        if (!feature || !Number.isFinite(clusterId)) return;
        const source = map?.getSource("pins") as GeoJSONSource | undefined;
        source
          ?.getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const geometry = feature.geometry as GeoJSON.Point;
            map?.easeTo({
              center: [geometry.coordinates[0], geometry.coordinates[1]],
              zoom,
              duration: reduced ? 0 : 500,
            });
          })
          .catch(() => {
            /* keep the current view if the cluster cannot be expanded */
          });
      });
      map.on("mousemove", "pins", () => {
        if (map) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", "clusters", () => {
        if (map) map.getCanvas().style.cursor = "zoom-in";
      });
      map.on("mouseleave", "pins", () => {
        if (map) map.getCanvas().style.cursor = "";
      });
      map.on("mouseleave", "clusters", () => {
        if (map) map.getCanvas().style.cursor = "";
      });

      resize = new ResizeObserver(() => {
        map?.resize();
      });
      resize.observe(node);
      map.once("load", () => {
        map?.resize();
        paint();
      });

      let paintedTheme = theme;
      themeObserver = new MutationObserver(() => {
        if (!map) return;
        const next = readTheme();
        if (next === paintedTheme) return;
        paintedTheme = next;
        const center = map.getCenter();
        const zoom = map.getZoom();
        map.setStyle(styleFor(next));
        map.once("style.load", () => {
          map?.jumpTo({ center, zoom });
        });
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    })();

    return () => {
      cancelled = true;
      paintRef.current = null;
      resize?.disconnect();
      themeObserver?.disconnect();
      marker?.remove();
      you?.remove();
      map?.remove();
      map = null;
    };
  }, []);

  useEffect(() => {
    paintRef.current?.();
  }, [frame]);

  return <div ref={nodeRef} className="map-canvas" />;
}

function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  const specifier = new URL("/vendor/maplibre/maplibre-gl.mjs", window.location.href).href;
  const load = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<typeof import("maplibre-gl")>;
  return load(specifier);
}

function activeMark(pin: MapPin, onOpen: (href: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "map-active";
  root.addEventListener("click", () => onOpen(pin.href));
  const number = document.createElement("span");
  number.className = "map-active-num";
  number.textContent = pin.aqi == null ? "—" : String(pin.aqi);
  const stem = document.createElement("span");
  stem.className = "map-active-stem";
  const dot = document.createElement("span");
  dot.className = "map-active-dot";
  dot.style.color = bandAccent(pin.band);
  dot.style.background = bandAccent(pin.band);
  root.append(number, stem, dot);
  return root;
}

function toCollection(frame: MapFrame): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: frame.pins.map((pin) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pin.lon, pin.lat] },
      properties: {
        slug: pin.slug,
        name: pin.name,
        place: pin.place,
        aqi: pin.aqi == null ? "" : String(pin.aqi),
        label: pin.aqi == null ? "" : String(pin.aqi),
        band: pin.band ?? "",
        href: pin.href,
        color: bandAccent(pin.band),
        clusterColor: bandAccent(pin.band),
        ink: inkFor(pin.band),
        rank: pin.aqi == null ? 0 : pin.aqi,
        active: pin.slug === frame.activeSlug ? 1 : 0,
      },
    })),
  };
}

function fit(map: MapLibreMap, frame: MapFrame, reduced: boolean) {
  if (frame.pins.length === 0) {
    map.jumpTo({ center: [80.2, 22.6], zoom: 3.7 });
    return;
  }
    if (frame.pins.length === 1 && !frame.user) {
    const pin = frame.pins[0];
    const move = { center: [pin.lon, pin.lat] as [number, number], zoom: 9.5 };
    if (reduced) map.jumpTo(move);
    else map.easeTo({ ...move, duration: 600 });
    return;
  }
  const first = frame.pins[0];
  let west = first.lon;
  let east = first.lon;
  let south = first.lat;
  let north = first.lat;
  for (const pin of frame.pins) {
    west = Math.min(west, pin.lon);
    east = Math.max(east, pin.lon);
    south = Math.min(south, pin.lat);
    north = Math.max(north, pin.lat);
  }
  if (frame.user) {
    west = Math.min(west, frame.user.lon);
    east = Math.max(east, frame.user.lon);
    south = Math.min(south, frame.user.lat);
    north = Math.max(north, frame.user.lat);
  }
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: { top: 120, right: 44, bottom: 80, left: 36 },
      maxZoom: 10.6,
      duration: reduced ? 0 : 700,
    },
  );
}

function styleFor(theme: ThemeName): string {
  return theme === "dark" ? DARK_STYLE : LIGHT_STYLE;
}

function strokeFor(theme: ThemeName): string {
  return theme === "dark" ? "#100e0c" : "#fffdf8";
}

/** Clusters are counts, not readings, so they stay neutral. */
function clusterFill(theme: ThemeName): string {
  return theme === "dark" ? "#3a352e" : "#242019";
}

/** Dark ink on the warm bands, light ink on the deep reds. */
function inkFor(band: Band | null): string {
  if (band === "Very Poor" || band === "Severe") return "#fffdf8";
  return "#17140f";
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
