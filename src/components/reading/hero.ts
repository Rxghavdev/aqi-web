import type { CSSProperties } from "react";
import { bandAccent } from "@/lib/aqi";
import type { Band } from "@/lib/types";

export function heroTone(band: Band | null): "alert" | "calm" | "quiet" {
  if (band === "Poor" || band === "Very Poor" || band === "Severe") return "alert";
  if (band == null) return "quiet";
  return "calm";
}

export function heroClass(band: Band | null): string {
  return `hero is-${heroTone(band)}`;
}

export function heroStyle(band: Band | null): CSSProperties {
  return { "--band": bandAccent(band) } as CSSProperties;
}
