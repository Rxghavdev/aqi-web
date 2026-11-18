/**
 * Fallback while a route without its own `loading.tsx` streams in. Pages with
 * a bespoke skeleton (city, station, near) keep theirs. Motion is a single
 * thin bar and is switched off by the global reduced-motion rule.
 */
export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-bar" aria-hidden="true" />
      <span className="route-loading-label">Loading</span>
    </div>
  );
}
