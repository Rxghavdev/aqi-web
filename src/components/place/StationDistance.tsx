"use client";

import { useEffect, useState } from "react";
import { haversineKm, roundKm } from "@/lib/geo";
import { readSavedPoint } from "./storage";

export function StationDistance({
  latitude,
  longitude,
  prefix = "",
}: {
  latitude: number;
  longitude: number;
  prefix?: string;
}) {
  const [km, setKm] = useState<number | null>(null);

  useEffect(() => {
    const point = readSavedPoint();
    if (!point) return;
    setKm(roundKm(haversineKm(point.lat, point.lon, latitude, longitude)));
  }, [latitude, longitude]);

  if (km == null) return null;
  return (
    <span className="fact-inline">
      {prefix}
      {km.toFixed(1)} km from you
    </span>
  );
}
