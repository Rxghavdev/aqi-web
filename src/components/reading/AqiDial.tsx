import type { CSSProperties, ReactNode } from "react";
import { bandAccent } from "@/lib/aqi";
import type { Band } from "@/lib/types";

const SEGMENTS: Array<{ band: Band; from: number; to: number }> = [
  { band: "Good", from: 0, to: 50 },
  { band: "Satisfactory", from: 50, to: 100 },
  { band: "Moderate", from: 100, to: 200 },
  { band: "Poor", from: 200, to: 300 },
  { band: "Very Poor", from: 300, to: 400 },
  { band: "Severe", from: 400, to: 500 },
];

const START = 135;
const SWEEP = 270;
const CENTER = 120;
const RADIUS = 96;

function angleFor(value: number): number {
  const clamped = Math.min(500, Math.max(0, value));
  return START + (clamped / 500) * SWEEP;
}

function polar(angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.sin(radians),
    y: CENTER - RADIUS * Math.cos(radians),
  };
}

function arc(from: number, to: number): string {
  const start = polar(from);
  const end = polar(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * The gauge around the official number.
 * Segments follow the CPCB bands; the knob sits at the published index.
 */
export function AqiDial({
  value,
  band,
  children,
}: {
  value: number | null;
  band: Band | null;
  children: ReactNode;
}) {
  const angle = value == null ? null : angleFor(value);
  return (
    <div className="dial">
      <svg
        className="dial-svg dial-ring"
        viewBox="0 0 240 240"
        aria-hidden="true"
        focusable="false"
      >
        <path d={arc(START, START + SWEEP)} className="dial-base" />
        {SEGMENTS.map((segment) => (
          <path
            key={segment.band}
            d={arc(segment.from + 1.4, segment.to - 1.4)}
            stroke={bandAccent(segment.band)}
            strokeOpacity={value != null && value > segment.from ? 1 : 0.16}
            strokeWidth={value != null && value > segment.from ? 9 : 7}
            strokeLinecap="butt"
            fill="none"
          />
        ))}
      </svg>
      {angle != null ? (
        <span
          className="dial-knob"
          style={{ "--angle": `${angle}deg` } as CSSProperties}
          aria-hidden="true"
        >
          <span style={{ background: bandAccent(band) }} />
        </span>
      ) : null}
      <span className="dial-halo" aria-hidden="true" style={{ background: `radial-gradient(circle, ${bandAccent(band)} 0%, transparent 70%)` }} />
      <div className="dial-core">{children}</div>
    </div>
  );
}
