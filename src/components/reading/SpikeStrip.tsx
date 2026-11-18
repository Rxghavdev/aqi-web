import type { Spike } from "@/lib/types";

export function SpikeStrip({ spike }: { spike: Spike | null }) {
  if (!spike?.active) return null;
  return (
    <aside className="spike" aria-label="Rising this hour">
      <p className="spike-kicker">Rising this hour</p>
      {spike.summary ? <p>{spike.summary}</p> : null}
    </aside>
  );
}
