export const LOC_KEY = "aqi-desk-loc";

export type SavedPoint = { lat: number; lon: number };

export function readSavedPoint(): SavedPoint | null {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw || raw === "skip") return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const lat = (parsed as { lat?: unknown }).lat;
    const lon = (parsed as { lon?: unknown }).lon;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

export function writeSkip(): void {
  try {
    localStorage.setItem(LOC_KEY, "skip");
  } catch {
    /* Private mode can refuse the write. The sheet still closes. */
  }
}

export function writePoint(lat: number, lon: number): void {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify({ lat, lon }));
  } catch {
    /* Navigation still carries the coordinates. */
  }
}
