import type { Band } from "./types";

/**
 * One calm, factual line under the AQI, one per band. No exclamation marks and
 * no medical claims; the band name and the number carry the detail.
 */
export function hookLine(band: Band | null): string {
  switch (band) {
    case "Good":
      return "Clean air. A good day to be outside.";
    case "Satisfactory":
      return "Fine for most people. Very sensitive people may notice it.";
    case "Moderate":
      return "Fine for most. Sensitive groups may feel it on long outdoor efforts.";
    case "Poor":
      return "Keep the long stuff indoors. Short trips outside are fine.";
    case "Very Poor":
      return "Time outdoors adds up at this level. Keep it short.";
    case "Severe":
      return "Severe air. Stay indoors where you can.";
    default:
      return "This station has not reported enough pollutants for an AQI.";
  }
}
