import type { ReactNode } from "react";
import Link from "next/link";
import { ShareButton } from "./ShareButton";

export type Crumb = { label: string; href?: string };

/**
 * The one rhythm every place page follows:
 * breadcrumb and title row, then reading card beside facts, then the map,
 * then sections (pollutants, history, stations, nearby).
 */
export function PlaceLayout({
  head,
  hero,
  side,
  map,
  children,
}: {
  head: ReactNode;
  hero: ReactNode;
  side: ReactNode;
  map: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="place">
      {head}
      <div className="place-top">
        <div className="place-hero">{hero}</div>
        <div className="place-side">{side}</div>
      </div>
      <div className="place-map">{map}</div>
      {children}
    </article>
  );
}

export function PlaceHead({
  crumbs,
  title,
  sub,
  share,
}: {
  crumbs: Crumb[];
  title: string;
  sub?: ReactNode;
  share: { title: string; text: string; path?: string };
}) {
  return (
    <header className="phead">
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`}>
                {crumb.href && !last ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span aria-current={last ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="phead-row">
        <div className="phead-text">
          <h1 className="phead-title">{title}</h1>
          {sub ? <p className="phead-sub">{sub}</p> : null}
        </div>
        <ShareButton title={share.title} text={share.text} path={share.path} />
      </div>
    </header>
  );
}

export function PlaceSection({
  id,
  title,
  sub,
  children,
}: {
  id?: string;
  title: string;
  sub?: ReactNode;
  children: ReactNode;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} className="psec" aria-labelledby={headingId}>
      <header className="psec-head">
        <h2 id={headingId} className="psec-title">
          {title}
        </h2>
        {sub ? <p className="psec-sub">{sub}</p> : null}
      </header>
      {children}
    </section>
  );
}
