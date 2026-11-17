import type { Band, PollutantId } from "./types";

/**
 * CPCB National Air Quality Index breakpoints.
 * Each row is [concentration low, concentration high, index low, index high].
 * Edges match the published bands. The top of Severe is the upper bound used
 * so a concentration past the last named range can still reach 500.
 * CO is mg/m³. Every other pollutant is µg/m³.
 * Use this only for raw concentrations (hourly model or a sensor).
 * data.gov.in avg_value is already a sub-index. Do not pass it through here.
 */
const BREAKPOINTS: Record<PollutantId, readonly (readonly [number, number, number, number])[]> =
  {
    "PM2.5": [
      [0, 30, 0, 50],
      [31, 60, 51, 100],
      [61, 90, 101, 200],
      [91, 120, 201, 300],
      [121, 250, 301, 400],
      [251, 500, 401, 500],
    ],
    PM10: [
      [0, 50, 0, 50],
      [51, 100, 51, 100],
      [101, 250, 101, 200],
      [251, 350, 201, 300],
      [351, 430, 301, 400],
      [431, 600, 401, 500],
    ],
    NO2: [
      [0, 40, 0, 50],
      [41, 80, 51, 100],
      [81, 180, 101, 200],
      [181, 280, 201, 300],
      [281, 400, 301, 400],
      [401, 800, 401, 500],
    ],
    SO2: [
      [0, 40, 0, 50],
      [41, 80, 51, 100],
      [81, 380, 101, 200],
      [381, 800, 201, 300],
      [801, 1600, 301, 400],
      [1601, 2000, 401, 500],
    ],
    CO: [
      [0, 1, 0, 50],
      [1.1, 2, 51, 100],
      [2.1, 10, 101, 200],
      [10.1, 17, 201, 300],
      [17.1, 34, 301, 400],
      [34.1, 50, 401, 500],
    ],
    OZONE: [
      [0, 50, 0, 50],
      [51, 100, 51, 100],
      [101, 168, 101, 200],
      [169, 208, 201, 300],
      [209, 748, 301, 400],
      [749, 1000, 401, 500],
    ],
    NH3: [
      [0, 200, 0, 50],
      [201, 400, 51, 100],
      [401, 800, 101, 200],
      [801, 1200, 201, 300],
      [1201, 1800, 301, 400],
      [1801, 2400, 401, 500],
    ],
    PB: [
      [0, 0.5, 0, 50],
      [0.6, 1, 51, 100],
      [1.1, 2, 101, 200],
      [2.1, 3, 201, 300],
      [3.1, 3.5, 301, 400],
      [3.6, 5, 401, 500],
    ],
  };

export function normalizePollutant(raw: string): PollutantId | null {
  const key = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (key === "PM2.5" || key === "PM25") return "PM2.5";
  if (key === "PM10") return "PM10";
  if (key === "NO2") return "NO2";
  if (key === "SO2") return "SO2";
  if (key === "CO") return "CO";
  if (key === "O3" || key === "OZONE") return "OZONE";
  if (key === "NH3") return "NH3";
  if (key === "PB" || key === "LEAD") return "PB";
  return null;
}

export function indiaAqiFromConcentration(
  pollutant: PollutantId,
  concentration: number,
): number | null {
  if (!Number.isFinite(concentration) || concentration < 0) return null;
  const ranges = BREAKPOINTS[pollutant];
  for (const [low, high, indexLow, indexHigh] of ranges) {
    if (concentration + 1e-9 < low) {
      return indexLow;
    }
    if (concentration <= high) {
      if (high === low) return indexHigh;
      const value =
        ((indexHigh - indexLow) / (high - low)) * (concentration - low) +
        indexLow;
      return clampIndex(Math.round(value));
    }
  }
  return 500;
}

export function clampIndex(value: number): number {
  return Math.min(500, Math.max(0, value));
}

export function bandFor(aqi: number | null): Band | null {
  if (aqi == null || !Number.isFinite(aqi)) return null;
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

export function healthLine(band: Band | null): string {
  switch (band) {
    case "Good":
      return "A normal day to be outside.";
    case "Satisfactory":
      return "Fine for most people. Unusually sensitive people can ease off.";
    case "Moderate":
      return "Most people can be outside. If you have asthma or heart disease, keep a long hard effort shorter.";
    case "Poor":
      return "Shorten outdoor exercise. Sensitive people should spend more time indoors.";
    case "Very Poor":
      return "Stay indoors when you can, and skip outdoor exercise.";
    case "Severe":
      return "Stay indoors and avoid outdoor exertion. Follow local health advice.";
    default:
      return "This station has not published enough pollutants for an official AQI.";
  }
}

/** Number color on the paper background. Moderate stays ink so yellow text is never the number. */
export function bandNumberColor(band: Band | null): string {
  switch (band) {
    case "Good":
      return "#146c3a";
    case "Satisfactory":
      return "#3f6212";
    case "Moderate":
      return "#1c1915";
    case "Poor":
      return "#c2410c";
    case "Very Poor":
      return "#be123c";
    case "Severe":
      return "#9f1239";
    default:
      return "#1c1915";
  }
}

export function bandAccent(band: Band | null): string {
  switch (band) {
    case "Good":
      return "#1f8a4c";
    case "Satisfactory":
      return "#65a30d";
    case "Moderate":
      return "#ca8a04";
    case "Poor":
      return "#ea580c";
    case "Very Poor":
      return "#e11d48";
    case "Severe":
      return "#be123c";
    default:
      return "#a8a29e";
  }
}
