export const SITE_NAME = "AQI Desk";

export const SITE_DESCRIPTION =
  "India's official air quality, station by station, from the Central Pollution Control Board. The number on this site is the National Air Quality Index.";

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
