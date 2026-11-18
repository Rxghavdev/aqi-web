"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { bandAccent } from "@/lib/aqi";
import { readTheme, type ThemeName } from "@/components/shell/theme";
import { cityPins, safeMapHref, type MapPin } from "./pins";
import "maplibre-gl/dist/maplibre-gl.css";

const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/positron";
const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

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

  useEffect(() => {
    setScope(pins.length > 0 ? "here" : "india");
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
  const framed = useMemo<MapFrame>(() => {
    const local = scope === "here";
    return {
      pins: shown,
      activeSlug: local ? activeSlug : null,
      user,
      fitKey: `${scope}:${shown.map((pin) => pin.slug).join("|")}:${user ? `${user.lat.toFixed(3)},${user.lon.toFixed(3)}` : ""}`,
    };
  }, [shown, scope, activeSlug, user]);

  const caption =
    scope === "india"
      ? indiaError
        ? "City averages did not load."
        : indiaPins
          ? "Each dot is a city average, from CPCB monitors."
          : "Placing city averages."
      : "Each dot is a CPCB monitor, not the air on a street.";

  return (
    <section className={`${frame} map-frame`} aria-label="Map of official readings">
      <MapCanvas frame={framed} />
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
      {pins.length > 0 ? (
        <div className="map-scope" role="group" aria-label="Map extent">
          <button
            type="button"
            aria-pressed={scope === "here"}
            onClick={() => setScope("here")}
          >
            {hereLabel}
          </button>
          <button
            type="button"
            aria-pressed={scope === "india"}
            onClick={() => setScope("india")}
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

function MapCanvas({ frame }: { frame: MapFrame }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const paintRef = useRef<(() => void) | null>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  frameRef.current = frame;
  routerRef.current = router;

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
          map.setPaintProperty("pin-labels", "text-halo-color", strokeFor(readTheme()));
        } else if (!map.getLayer("pins")) {
          map.addSource("pins", { type: "geojson", data });
          map.addLayer({
            id: "pins",
            type: "circle",
            source: "pins",
            layout: {
              "circle-sort-key": ["get", "rank"],
            },
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3.2,
                9,
                6,
                11,
                11,
                14,
              ],
              "circle-color": ["get", "color"],
              "circle-opacity": ["case", ["==", ["get", "active"], 1], 0, 0.96],
              "circle-stroke-width": 1.5,
              "circle-stroke-color": strokeFor(readTheme()),
            },
          });
          map.addLayer({
            id: "pin-labels",
            type: "symbol",
            source: "pins",
            filter: ["all", ["!=", ["get", "label"], ""], ["!=", ["get", "active"], 1]],
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Bold"],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3.2,
                8,
                6,
                9,
                11,
                11,
              ],
              "text-allow-overlap": false,
              "text-padding": 2,
              "text-ignore-placement": false,
              "symbol-sort-key": ["get", "rank"],
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": strokeFor(readTheme()),
              "text-halo-width": 1.1,
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
                if (safe) routerRef.current.push(safe);
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
        const href = safeMapHref(event.features?.[0]?.properties?.href);
        if (href) routerRef.current.push(href);
      });
      map.on("mousemove", "pins", (event) => {
        if (!map) return;
        map.getCanvas().style.cursor = "pointer";
        const feature = event.features?.[0];
        if (!feature) return;
        const popup = popupRef(maplibregl, map);
        popup.setLngLat(event.lngLat).setDOMContent(chip(feature.properties)).addTo(map);
      });
      map.on("mouseleave", "pins", () => {
        if (!map) return;
        map.getCanvas().style.cursor = "";
        popupRef(maplibregl, map).remove();
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

const popups = new WeakMap<MapLibreMap, import("maplibre-gl").Popup>();

function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  const specifier = new URL("/vendor/maplibre/maplibre-gl.mjs", window.location.href).href;
  const load = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<typeof import("maplibre-gl")>;
  return load(specifier);
}

function popupRef(
  maplibregl: typeof import("maplibre-gl"),
  map: MapLibreMap,
): import("maplibre-gl").Popup {
  const existing = popups.get(map);
  if (existing) return existing;
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: "map-chip",
    offset: 16,
    maxWidth: "240px",
  });
  popups.set(map, popup);
  return popup;
}

function chip(properties: GeoJSON.GeoJsonProperties): HTMLElement {
  const root = document.createElement("div");
  root.className = "map-chip-body";
  const name = document.createElement("p");
  name.className = "map-chip-name";
  name.textContent = textOf(properties, "name");
  const place = document.createElement("p");
  place.className = "map-chip-place";
  place.textContent = textOf(properties, "place");
  const read = document.createElement("p");
  read.className = "map-chip-read";
  const number = document.createElement("span");
  const aqi = textOf(properties, "aqi");
  number.textContent = aqi || "—";
  read.append(number, document.createTextNode(` ${textOf(properties, "band") || "Insufficient"}`));
  root.append(name, place, read);
  return root;
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
    const move = { center: [pin.lon, pin.lat] as [number, number], zoom: 10.5 };
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
      padding: { top: 108, right: 36, bottom: 72, left: 28 },
      maxZoom: 11.2,
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

function textOf(properties: GeoJSON.GeoJsonProperties, key: string): string {
  const value = properties?.[key];
  return typeof value === "string" ? value : "";
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
