"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
} from "maplibre-gl";
import { bandAccent } from "@/lib/aqi";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPin } from "./pins";

const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/positron";
const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

/**
 * Marker geometry is fixed in screen pixels, never scaled by zoom. The inner
 * radius leaves 30px of face, which clears a three-digit index at 11px bold.
 */
const DOT_RADIUS = 15;
const DOT_RING = 2.5;
const DOT_LABEL_SIZE = 11;
const RING_COLOR = "#fffdf8";
const CLUSTER_FILL = "#1c1814";
const SHADOW = "rgba(20, 14, 8, 0.38)";

/** Mainland India with the islands trimmed: the framing for "no pins yet". */
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [68.2, 7.4],
  [97.4, 35.8],
];

export type MapPoint = { lat: number; lon: number };

export type MapFrameData = {
  pins: MapPin[];
  activeSlug: string | null;
  user: MapPoint | null;
  fitKey: string;
};

export type MapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  flyTo: (point: MapPoint, zoom?: number) => void;
  /** Pan just enough that a pin is not hidden behind the pin card or chrome. */
  reveal: (point: MapPoint) => void;
};

export function MapCanvas({
  frame,
  selectedSlug,
  cooperative,
  handleRef,
  onSelect,
  onReady,
  onHint,
}: {
  frame: MapFrameData;
  selectedSlug: string | null;
  cooperative: boolean;
  handleRef: MutableRefObject<MapHandle | null>;
  onSelect: (pin: MapPin | null) => void;
  onReady: () => void;
  onHint: () => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const paintRef = useRef<(() => void) | null>(null);
  const selectRef = useRef<(() => void) | null>(null);
  const selectedRef = useRef(selectedSlug);
  const onSelectRef = useRef(onSelect);
  const onReadyRef = useRef(onReady);
  const onHintRef = useRef(onHint);
  const cooperativeRef = useRef(cooperative);

  // Refs are written in an effect, not during render: a render that React
  // discards must not leave the refs pointing at a frame that never committed.
  useEffect(() => {
    frameRef.current = frame;
    onSelectRef.current = onSelect;
    onReadyRef.current = onReady;
    onHintRef.current = onHint;
  }, [frame, onSelect, onReady, onHint]);

  useEffect(() => {
    selectedRef.current = selectedSlug;
    selectRef.current?.();
  }, [selectedSlug]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let map: MapLibreMap | null = null;
    let marker: Marker | null = null;
    let markerKey = "";
    let you: Marker | null = null;
    let resize: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;
    let readyTimer: number | undefined;
    let cancelled = false;
    let styleReady = false;
    let fitted = "";
    let hovered: string | null = null;
    let marked: string | null = null;
    let selectStamp = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const select = (pin: MapPin | null) => {
      selectStamp = Date.now();
      onSelectRef.current(pin);
    };

    void (async () => {
      const maplibregl = await loadMapLibre();
      if (cancelled) return;
      const theme = currentTheme();
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
        zoom: 3,
        minZoom: 1.5,
        maxZoom: 14.5,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: cooperativeRef.current,
        fadeDuration: reduced ? 0 : 250,
        locale: {
          "CooperativeGesturesHandler.WindowsHelpText": "Hold Ctrl and scroll to zoom the map",
          "CooperativeGesturesHandler.MacHelpText": "Hold ⌘ and scroll to zoom the map",
          "CooperativeGesturesHandler.MobileHelpText": "Use two fingers to move the map",
        },
      });
      if (cancelled) {
        map.remove();
        map = null;
        return;
      }
      const live = map;
      live.touchPitch.disable();
      live.touchZoomRotate.disableRotation();

      handleRef.current = {
        zoomIn: () => live.zoomIn({ duration: reduced ? 0 : 220 }),
        zoomOut: () => live.zoomOut({ duration: reduced ? 0 : 220 }),
        flyTo: (point, zoom = 11) =>
          live.easeTo({
            center: [point.lon, point.lat],
            zoom: Math.max(live.getZoom(), zoom),
            duration: reduced ? 0 : 700,
          }),
        reveal: (point) => {
          const box = live.getContainer();
          const width = box.clientWidth;
          const height = box.clientHeight;
          const narrow = width < 560;
          // The card sits bottom-left; chips and tools sit along the top and right.
          const cardWidth = narrow ? width - 8 - 54 : 344;
          const cardHeight = 190;
          const at = live.project([point.lon, point.lat]);
          const margin = 30;
          const behindCard =
            at.x < 8 + cardWidth + margin && at.y > height - cardHeight - 8 - margin;
          const behindTop = at.y < 54;
          const behindTools = at.x > width - 58 || at.x < 24;
          const outside = at.y > height - 24;
          if (!behindCard && !behindTop && !behindTools && !outside) return;
          const target = narrow
            ? {
                x: (width - 54) / 2,
                y: Math.max(62, (height - cardHeight - 8) / 2),
              }
            : {
                x: 8 + cardWidth + (width - 8 - cardWidth - 58) / 2,
                y: height / 2,
              };
          live.panBy([at.x - target.x, at.y - target.y], { duration: reduced ? 0 : 350 });
        },
      };

      const applySelected = () => {
        if (!styleReady || !live.getSource("pins")) return;
        try {
          if (marked && marked !== selectedRef.current) {
            live.setFeatureState({ source: "pins", id: marked }, { selected: false });
            marked = null;
          }
          if (selectedRef.current && marked !== selectedRef.current) {
            live.setFeatureState(
              { source: "pins", id: selectedRef.current },
              { selected: true },
            );
            marked = selectedRef.current;
          }
        } catch {
          /* The feature may not be in the source yet; the next paint retries. */
        }
      };
      selectRef.current = applySelected;

      const setHover = (slug: string | null) => {
        if (hovered === slug) return;
        try {
          if (hovered) live.setFeatureState({ source: "pins", id: hovered }, { hover: false });
          if (slug) live.setFeatureState({ source: "pins", id: slug }, { hover: true });
        } catch {
          /* Same as above: a missing feature just has no hover. */
        }
        hovered = slug;
        live.getCanvas().style.cursor = slug ? "pointer" : "";
      };

      const paint = () => {
        if (!styleReady) return;
        const current = frameRef.current;
        const data = toCollection(current);
        const source = live.getSource("pins");
        if (source && "setData" in source) {
          (source as GeoJSONSource).setData(data);
        } else if (!live.getLayer("pins")) {
          addLayers(live, data);
        }

        const active = current.pins.find((pin) => pin.slug === current.activeSlug) ?? null;
        const activeKey = active ? `${active.slug}:${active.aqi ?? ""}:${active.band ?? ""}` : "";
        if (active) {
          if (!marker || markerKey !== activeKey) {
            marker?.remove();
            marker = new maplibregl.Marker({
              element: activeMark(active, () => {
                select(active);
                handleRef.current?.reveal({ lat: active.lat, lon: active.lon });
              }),
              anchor: "center",
            })
              .setLngLat([active.lon, active.lat])
              .addTo(live);
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
            dot.setAttribute("role", "img");
            dot.setAttribute("aria-label", "Your location");
            you = new maplibregl.Marker({ element: dot, anchor: "center" })
              .setLngLat([current.user.lon, current.user.lat])
              .addTo(live);
          } else {
            you.setLngLat([current.user.lon, current.user.lat]);
          }
        } else if (you) {
          you.remove();
          you = null;
        }

        if (fitted !== current.fitKey) {
          fitted = current.fitKey;
          fit(live, current, reduced);
        }
        // A style swap drops feature state, so reapply it after every paint.
        marked = null;
        applySelected();
      };

      paintRef.current = paint;
      live.on("style.load", () => {
        styleReady = true;
        paint();
      });
      live.on("click", "pins", (event) => {
        const slug = String(event.features?.[0]?.properties?.slug ?? "");
        const pin = frameRef.current.pins.find((item) => item.slug === slug);
        if (!pin) return;
        select(pin);
        handleRef.current?.reveal({ lat: pin.lat, lon: pin.lon });
      });
      live.on("click", "clusters", (event) => {
        const feature = event.features?.[0];
        const clusterId = Number(feature?.properties?.cluster_id);
        if (!feature || !Number.isFinite(clusterId)) return;
        const source = live.getSource("pins") as GeoJSONSource | undefined;
        source
          ?.getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const geometry = feature.geometry as GeoJSON.Point;
            live.easeTo({
              center: [geometry.coordinates[0], geometry.coordinates[1]],
              zoom,
              duration: reduced ? 0 : 500,
            });
          })
          .catch(() => {
            /* keep the current view if the cluster cannot be expanded */
          });
      });
      // A click on empty map closes the card. Markers stop their own clicks, and
      // the stamp covers any click that lands in the same tick as a selection.
      live.on("click", (event) => {
        if (Date.now() - selectStamp < 120) return;
        const layers = ["pins", "clusters"].filter((id) => live.getLayer(id));
        if (layers.length > 0 && live.queryRenderedFeatures(event.point, { layers }).length > 0) {
          return;
        }
        onSelectRef.current(null);
      });
      live.on("mousemove", "pins", (event) => {
        setHover(String(event.features?.[0]?.properties?.slug ?? "") || null);
      });
      live.on("mouseleave", "pins", () => setHover(null));
      live.on("mousemove", "clusters", () => {
        live.getCanvas().style.cursor = "zoom-in";
      });
      live.on("mouseleave", "clusters", () => {
        live.getCanvas().style.cursor = "";
      });
      live.on("cooperativegestureprevented", (event) => {
        if (event.gestureType === "touch_pan") onHintRef.current();
      });

      resize = new ResizeObserver(() => {
        live.resize();
      });
      resize.observe(node);

      let signalled = false;
      const signalReady = () => {
        if (signalled || cancelled) return;
        signalled = true;
        onReadyRef.current();
      };
      live.once("load", () => {
        live.resize();
        paint();
        signalReady();
      });
      // A style that never loads (offline) must not leave the skeleton up forever.
      readyTimer = window.setTimeout(signalReady, 9000);

      let paintedTheme = theme;
      themeObserver = new MutationObserver(() => {
        const next = currentTheme();
        if (next === paintedTheme) return;
        paintedTheme = next;
        styleReady = false;
        live.setStyle(styleFor(next));
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    })();

    return () => {
      cancelled = true;
      paintRef.current = null;
      selectRef.current = null;
      handleRef.current = null;
      window.clearTimeout(readyTimer);
      resize?.disconnect();
      themeObserver?.disconnect();
      marker?.remove();
      you?.remove();
      map?.remove();
      map = null;
    };
    // The map is built once. Props reach it through refs and the paint effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    paintRef.current?.();
  }, [frame]);

  return <div ref={nodeRef} className="map-canvas" />;
}

function addLayers(map: MapLibreMap, data: GeoJSON.FeatureCollection) {
  // Dense cities overlap at city zoom. Clusters keep every dot legible, and
  // zooming in splits them into individual stations.
  map.addSource("pins", {
    type: "geojson",
    data,
    cluster: true,
    clusterRadius: 34,
    clusterMaxZoom: 12,
    promoteId: "slug",
  });

  const radius: ExpressionSpecification = [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    DOT_RADIUS + 4,
    ["boolean", ["feature-state", "hover"], false],
    DOT_RADIUS + 2,
    DOT_RADIUS,
  ];
  const single: FilterSpecification = [
    "all",
    ["!", ["has", "point_count"]],
    ["!=", ["get", "active"], 1],
  ];

  map.addLayer({
    id: "cluster-shadow",
    type: "circle",
    source: "pins",
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 22, 8, 25, 20, 29],
      "circle-color": SHADOW,
      "circle-blur": 0.85,
      "circle-translate": [0, 2],
    },
  });
  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "pins",
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 17, 8, 20, 20, 24],
      "circle-color": CLUSTER_FILL,
      "circle-stroke-width": DOT_RING,
      "circle-stroke-color": RING_COLOR,
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
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "pin-shadow",
    type: "circle",
    source: "pins",
    filter: single,
    layout: { "circle-sort-key": ["get", "rank"] },
    paint: {
      "circle-radius": DOT_RADIUS + 4,
      "circle-color": SHADOW,
      "circle-blur": 0.85,
      "circle-translate": [0, 2],
    },
  });
  map.addLayer({
    id: "pins",
    type: "circle",
    source: "pins",
    filter: single,
    layout: { "circle-sort-key": ["get", "rank"] },
    paint: {
      // Constant in screen pixels, so a three-digit label clears the ring.
      "circle-radius": radius,
      "circle-radius-transition": { duration: 140, delay: 0 },
      "circle-color": ["get", "color"],
      "circle-stroke-width": DOT_RING,
      "circle-stroke-color": RING_COLOR,
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
    paint: { "text-color": ["get", "ink"] },
  });
}

function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  const specifier = "/vendor/maplibre/maplibre-gl.mjs";
  // A literal specifier so bundlers leave it alone; the browser resolves it
  // against the current origin. Avoids eval, which a strict CSP would block.
  // The browser caches the module, so every canvas shares one download.
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier) as Promise<
    typeof import("maplibre-gl")
  >;
}

/** The station the page is about: same face as a dot, plus a pulsing ping. */
function activeMark(pin: MapPin, onOpen: () => void): HTMLElement {
  const color = bandAccent(pin.band);
  const root = document.createElement("div");
  root.className = "map-active";
  root.tabIndex = 0;
  root.setAttribute("role", "button");
  root.setAttribute(
    "aria-label",
    `${pin.name}, AQI ${pin.aqi ?? "not available"}. Show details`,
  );
  root.style.setProperty("--pin", color);
  root.style.setProperty("--pin-ink", inkOn(color));
  const ping = document.createElement("span");
  ping.className = "map-active-ping";
  ping.setAttribute("aria-hidden", "true");
  const core = document.createElement("span");
  core.className = "map-active-core";
  core.textContent = pin.aqi == null ? "–" : String(pin.aqi);
  root.append(ping, core);
  root.addEventListener("click", (event) => {
    event.stopPropagation();
    onOpen();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  });
  return root;
}

function toCollection(frame: MapFrameData): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: frame.pins.map((pin) => {
      const color = bandAccent(pin.band);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [pin.lon, pin.lat] },
        properties: {
          slug: pin.slug,
          label: pin.aqi == null ? "" : String(pin.aqi),
          color,
          ink: inkOn(color),
          rank: pin.aqi == null ? 0 : pin.aqi,
          active: pin.slug === frame.activeSlug ? 1 : 0,
        },
      };
    }),
  };
}

function fit(map: MapLibreMap, frame: MapFrameData, reduced: boolean) {
  const box = map.getContainer();
  const height = box.clientHeight;
  const width = box.clientWidth;
  if (width === 0 || height === 0) return;
  const padding = {
    top: height < 380 ? 30 : 36,
    bottom: height < 380 ? 34 : 40,
    left: 24,
    right: width < 420 ? 52 : 60,
  };

  if (frame.pins.length === 0) {
    map.fitBounds(INDIA_BOUNDS, { padding, maxZoom: 5.2, duration: 0 });
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
    { padding, maxZoom: 10.6, duration: reduced ? 0 : 700 },
  );
}

/**
 * The shell sets `data-theme` on <html> (see components/shell/theme.ts). The
 * attribute is the contract, so the map reads it directly and observes it.
 */
function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function styleFor(theme: "light" | "dark"): string {
  return theme === "dark" ? DARK_STYLE : LIGHT_STYLE;
}

/** Light or dark ink, whichever reads better on the band colour. */
export function inkOn(hex: string): string {
  const light = contrast(luminance(hex), 1);
  const dark = contrast(luminance(hex), 0.007);
  return light >= dark ? "#ffffff" : "#17140f";
}

function contrast(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channel = (offset: number) => {
    const v = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
