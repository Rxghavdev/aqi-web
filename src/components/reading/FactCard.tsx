import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export type Fact = { label: string; value: ReactNode; icon?: IconName };

/**
 * Small icon + value tiles beside the number. Each tile answers one
 * question at a glance: how many stations, set by what, how far.
 */
export function FactCard({
  facts,
  note,
  children,
}: {
  facts: Fact[];
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="facts" aria-label="Key facts">
      <dl className="facts-grid">
        {facts.map((fact) => (
          <div key={fact.label} className="fact">
            <span className="fact-icon">
              <Icon name={fact.icon ?? "layers"} size={18} />
            </span>
            <dt className="fact-label">{fact.label}</dt>
            <dd className="fact-value">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className="fact-note">{note}</p> : null}
      {children}
    </section>
  );
}
