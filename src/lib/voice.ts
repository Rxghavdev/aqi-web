import type { Band } from "./types";

/** Short line under the official number. Warm, specific, not a slogan deck. */
export function hookLine(band: Band | null): string {
  switch (band) {
    case "Good":
      return "Step out. India's official number says the air is on your side.";
    case "Satisfactory":
      return "Mostly fine. If your lungs are fussy, take the long effort easier.";
    case "Moderate":
      return "A walk is fine. Save the long run if your chest complains.";
    case "Poor":
      return "Keep the long stuff indoors. This is the official reading, not a guess.";
    case "Very Poor":
      return "Mask up if you have to be out. The government monitors are in the red.";
    case "Severe":
      return "Stay in. This is severe on India's own scale.";
    default:
      return "This monitor has not published enough pollutants for an official number.";
  }
}
