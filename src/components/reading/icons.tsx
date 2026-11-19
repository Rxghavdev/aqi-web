import type { ReactNode } from "react";

export type IconName =
  | "station"
  | "pollutant"
  | "peak"
  | "spread"
  | "city"
  | "route"
  | "layers"
  | "thermometer"
  | "droplet"
  | "wind"
  | "sun"
  | "cloud"
  | "cloud-sun"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "uv"
  | "share"
  | "check"
  | "chevron"
  | "arrow";

/**
 * Small inline icon set: 24px grid, 1.75 stroke, no fill. Decorative by
 * default; the text beside each icon carries the meaning.
 */
const PATHS: Record<IconName, ReactNode> = {
  station: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  pollutant: (
    <>
      <path d="M9 3h6M10 3v6.2L5.2 18.4A1.6 1.6 0 0 0 6.6 21h10.8a1.6 1.6 0 0 0 1.4-2.6L14 9.2V3" />
      <path d="M7.6 15h8.8" />
    </>
  ),
  peak: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  spread: (
    <>
      <path d="M4 12h16" />
      <path d="M7 8l-3 4 3 4M17 8l3 4-3 4" />
    </>
  ),
  city: (
    <>
      <path d="M4 21V9l6-3v15M10 21V4l10 4v13M2 21h20" />
      <path d="M14 11h2M14 15h2M6.5 12h1M6.5 16h1" />
    </>
  ),
  route: <path d="M3 11l18-8-8 18-2-8-8-2z" />,
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  thermometer: <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />,
  droplet: <path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z" />,
  wind: <path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  uv: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  cloud: (
    <path d="M7 19a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19.4 12 3.5 3.5 0 0 1 18 19z" />
  ),
  "cloud-sun": (
    <>
      <path d="M12 3v1.5M4.2 6.2l1.1 1.1M20 12h1.5M19.8 6.2l-1.1 1.1" />
      <path d="M8.5 10a4 4 0 0 1 7.3-1.6" />
      <path d="M7 20a4 4 0 1 1 .8-7.9A5.2 5.2 0 0 1 17.9 13.5 3.3 3.3 0 0 1 17 20z" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19.4 8 3.5 3.5 0 0 1 18 15z" />
      <path d="M8 18l-1 2.5M12.5 18l-1 2.5M17 18l-1 2.5" />
    </>
  ),
  storm: (
    <>
      <path d="M7 15a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19.4 8 3.5 3.5 0 0 1 18 15z" />
      <path d="M12.5 13l-2.5 4h3.5l-2 4" />
    </>
  ),
  snow: (
    <>
      <path d="M7 15a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19.4 8 3.5 3.5 0 0 1 18 15z" />
      <path d="M8 18.5h.01M12 20.5h.01M16 18.5h.01" />
    </>
  ),
  fog: (
    <>
      <path d="M7 13a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19.4 6 3.5 3.5 0 0 1 18 13z" />
      <path d="M4 17h16M7 21h10" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M6 9.5l6 6 6-6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Picks a weather icon from the WMO code, falling back to the label. */
export function weatherIconName(code: number | null, label: string): IconName {
  if (code != null) {
    if (code === 0 || code === 1) return "sun";
    if (code === 2) return "cloud-sun";
    if (code === 3) return "cloud";
    if (code === 45 || code === 48) return "fog";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
  }
  const text = label.toLowerCase();
  if (text.includes("clear")) return "sun";
  if (text.includes("partly")) return "cloud-sun";
  if (text.includes("cloud") || text.includes("overcast")) return "cloud";
  if (
    text.includes("rain") ||
    text.includes("drizzle") ||
    text.includes("shower")
  )
    return "rain";
  if (text.includes("thunder")) return "storm";
  if (text.includes("snow")) return "snow";
  return "fog";
}
