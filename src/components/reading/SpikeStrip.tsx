import type { Spike } from "@/lib/types";

/** The hourly model reading. Always labelled as an estimate, never official. */
export function SpikeStrip({ spike }: { spike: Spike | null }) {
  if (!spike?.active) return null;
  return (
    <aside className="spike" aria-label="Estimate: rising this hour">
      <p className="spike-kicker">
        <span className="spike-pill">Estimate</span>
        Rising this hour
      </p>
      {spike.summary ? <p className="spike-text">{spike.summary}</p> : null}
    </aside>
  );
}
