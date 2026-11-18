/**
 * Hawa mark: an open gauge ring with a wind stroke curling inside it.
 * One source of geometry for the header logo, the favicon, the Apple icon
 * and the social image. 32 x 32 grid, 3-unit round strokes.
 */
export const MARK_VIEWBOX = "0 0 32 32";

/** Gauge ring, open at the bottom, ending where the accent begins. */
export const MARK_RING = "M7.2 24.8A12.5 12.5 0 1 1 27.75 20.28";

/** The last stretch of the ring, the "reading". */
export const MARK_ACCENT = "M27.75 20.28A12.5 12.5 0 0 1 24.8 24.8";

/** Two wind strokes, the upper one curling back on itself. */
export const MARK_WIND = ["M9 16.2H19.5A3.4 3.4 0 1 0 16.1 12.8", "M9 20.9H14.5"];

export const MARK_STROKE = 3;

/** Accent orange, readable on both the light and the dark paper. */
export const MARK_ACCENT_COLOR = "#ea580c";
