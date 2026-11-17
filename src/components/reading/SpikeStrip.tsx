import type { Spike } from "@/lib/types";

export function SpikeStrip({ spike }: { spike: Spike | null }) {
  if (!spike?.active) return null;
  return (
    <aside className="spike" aria-label="Rising this hour">
      <h2>Rising this hour</h2>
      {spike.summary ? <p>{spike.summary}</p> : null}
    </aside>
  );
}
