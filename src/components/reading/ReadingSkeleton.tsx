/**
 * Page-shaped placeholder for city, station and nearest-station pages.
 * Every block reserves the height of the real one, so nothing jumps when the
 * reading arrives.
 */
export function ReadingSkeleton() {
  return (
    <div className="place" aria-busy="true">
      <p className="sr-only">Loading the reading.</p>
      <div className="sk-head" aria-hidden="true">
        <span className="sk sk-crumb" />
        <span className="sk sk-title" />
        <span className="sk sk-sub" />
      </div>
      <div className="place-top" aria-hidden="true">
        <div className="sk sk-hero" />
        <div className="place-side">
          <div className="sk-facts">
            <span className="sk sk-fact" />
            <span className="sk sk-fact" />
            <span className="sk sk-fact" />
            <span className="sk sk-fact" />
          </div>
          <div className="sk sk-weather" />
        </div>
      </div>
      <div className="sk sk-map" aria-hidden="true" />
    </div>
  );
}

export function CityListFallback() {
  return (
    <div aria-busy="true">
      <p className="sr-only">Loading cities.</p>
      <div className="rank-list" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="skeleton-row" />
        ))}
      </div>
    </div>
  );
}
