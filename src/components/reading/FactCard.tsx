import type { ReactNode } from "react";

export type Fact = { label: string; value: ReactNode };

/**
 * The quiet card beside the number. Label/value pairs so a glance
 * answers "how far", "from what", "compared with what".
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
    <section className="paper-card fact-card">
      <dl className="fact-grid">
        {facts.map((fact) => (
          <div key={fact.label} className="fact">
            <dt className="fact-label">{fact.label}</dt>
            <dd className="fact-value">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      {note ? <p className="fact-note">{note}</p> : null}
    </section>
  );
}
