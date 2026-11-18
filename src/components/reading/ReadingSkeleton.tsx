export function ReadingSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">Loading the reading.</p>
      <div className="skeleton-numeral" aria-hidden="true" />
      <div className="skeleton-line" aria-hidden="true" />
      <div className="skeleton-line skeleton-line-short" aria-hidden="true" />
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
