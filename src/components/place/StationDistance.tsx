"use client";

import { useSyncExternalStore } from "react";
import { haversineKm, roundKm } from "@/lib/geo";
import { LOC_KEY, readSavedPoint } from "./storage";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function snapshot(): string | null {
  try {
    return localStorage.getItem(LOC_KEY);
  } catch {
    return null;
  }
}

/** Distance from the visitor's saved point. Renders nothing without one. */
export function StationDistance({
  latitude,
  longitude,
  prefix = "",
}: {
  latitude: number;
  longitude: number;
  prefix?: string;
}) {
  // The saved point only exists in the browser, so the server snapshot is null
  // and the first client render matches it.
  const saved = useSyncExternalStore(subscribe, snapshot, () => null);
  const point = saved ? readSavedPoint() : null;
  if (!point) return null;
  const km = roundKm(haversineKm(point.lat, point.lon, latitude, longitude));
  return (
    <span className="fact-inline">
      {prefix}
      {km.toFixed(1)} km from you
    </span>
  );
}
