import type { CSSProperties } from "react";
import type { Band } from "@/lib/types";

/**
 * A moving sky behind the reading. Clouds drift across, the haze thickens and
 * more particles float up as the official band worsens. Decorative only: pure
 * CSS, no script, hidden from assistive tech, positions are deterministic so
 * server and client markup match.
 */

const LEVEL: Record<Band, number> = {
  Good: 0,
  Satisfactory: 1,
  Moderate: 2,
  Poor: 3,
  "Very Poor": 4,
  Severe: 5,
};

const CLOUDS = [
  { top: 3, width: 11, x: 8, duration: 46, delay: -12, opacity: 0.9 },
  { top: 22, width: 15, x: 52, duration: 62, delay: -40, opacity: 0.7 },
  { top: 48, width: 9, x: 28, duration: 38, delay: -22, opacity: 0.8 },
  { top: 70, width: 13, x: 70, duration: 54, delay: -8, opacity: 0.65 },
];

export function Atmosphere({ band }: { band: Band | null }) {
  if (band == null) return null;
  const level = LEVEL[band];
  const motes = 8 + level * 5;

  return (
    <div
      className="atmo"
      aria-hidden="true"
      style={{ "--lvl": level, "--cloud-mix": `${12 + level * 3}%` } as CSSProperties}
    >
      <span className="atmo-smog" />
      <span className="atmo-smog atmo-smog-b" />
      {CLOUDS.map((cloud, index) => (
        <span
          key={index}
          className="atmo-cloud"
          style={
            {
              top: `${cloud.top}%`,
              width: `${cloud.width}rem`,
              opacity: cloud.opacity,
              "--x": `${cloud.x}cqw`,
              animationDuration: `${cloud.duration}s`,
              animationDelay: `${cloud.delay}s`,
            } as CSSProperties
          }
        >
          <svg viewBox="0 0 160 80" focusable="false">
            <path d="M24 72C6 72 0 58 4 48 8 36 20 34 28 36 30 18 48 8 66 14 74 2 98 0 110 16 128 8 148 20 146 38 160 40 164 62 148 70 144 72 140 72 136 72Z" />
          </svg>
        </span>
      ))}
      {Array.from({ length: motes }, (_, i) => (
        <span
          key={i}
          className="atmo-mote"
          style={
            {
              left: `${(i * 37 + 11) % 97}%`,
              width: `${3 + ((i * 5) % 4)}px`,
              height: `${3 + ((i * 5) % 4)}px`,
              "--dx": `${((i * 13) % 9) - 4}rem`,
              animationDuration: `${9 + ((i * 7) % 10)}s`,
              animationDelay: `${-((i * 17) % 19)}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
