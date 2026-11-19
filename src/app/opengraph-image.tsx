import { ImageResponse } from "next/og";
import {
  MARK_ACCENT,
  MARK_RING,
  MARK_STROKE,
  MARK_VIEWBOX,
  MARK_WIND,
} from "@/components/brand/mark";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1a1714";
const PAPER = "#f4efe6";
const MUTED = "#6b645c";
// The six CPCB bands, Good to Severe.
const BANDS = ["#1f8a4c", "#65a30d", "#ca8a04", "#ea580c", "#e11d48", "#be123c"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: "72px 88px 0 88px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 56, marginTop: 40 }}>
          <svg
            width="280"
            height="280"
            viewBox={MARK_VIEWBOX}
            fill="none"
            strokeWidth={MARK_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g stroke={INK}>
              <path d={MARK_RING} />
              {MARK_WIND.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <path d={MARK_ACCENT} stroke="#ea580c" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 168,
                fontWeight: 700,
                letterSpacing: "-0.055em",
                lineHeight: 1,
                // The bundled image font ships one weight; a stroke gives the wordmark its bold.
                WebkitTextStroke: `5px ${INK}`,
              }}
            >
              {SITE_NAME}
            </div>
            <div
              style={{
                marginTop: 22,
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: MUTED,
                WebkitTextStroke: `1px ${MUTED}`,
              }}
            >
              {SITE_TAGLINE}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 72 }}>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden" }}>
            {BANDS.map((color) => (
              <div key={color} style={{ flex: 1, background: color }} />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 28,
              fontWeight: 600,
              color: MUTED,
            }}
          >
            <span>Live air quality across India</span>
            <span>National Air Quality Index, 0–500</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
