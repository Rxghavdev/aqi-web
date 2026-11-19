import { ImageResponse } from "next/og";
import {
  MARK_ACCENT,
  MARK_RING,
  MARK_STROKE,
  MARK_VIEWBOX,
  MARK_WIND,
} from "@/components/brand/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1714",
        }}
      >
        <svg
          width="132"
          height="132"
          viewBox={MARK_VIEWBOX}
          fill="none"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g stroke="#f4efe6">
            <path d={MARK_RING} />
            {MARK_WIND.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path d={MARK_ACCENT} stroke="#fb923c" />
        </svg>
      </div>
    ),
    size,
  );
}
