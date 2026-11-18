import Link from "next/link";
import type { ReactNode } from "react";

/** Page header shared by every long-form page: eyebrow, bold title, one-line lede. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  meta,
  titleId = "page-title",
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  meta?: string;
  titleId?: string;
}) {
  return (
    <header className="pg-header">
      <p className="pg-eyebrow">{eyebrow}</p>
      <h1 id={titleId} className="pg-title">
        {title}
      </h1>
      <p className="pg-lede">{lede}</p>
      {meta ? <p className="pg-meta">{meta}</p> : null}
    </header>
  );
}

/** A titled section. `id` doubles as the anchor target for the contents list. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="pg-section" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="pg-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Short boxed note. Quiet by default. */
export function Callout({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="pg-callout">
      {title ? <p className="pg-callout-title">{title}</p> : null}
      <div className="pg-callout-body">{children}</div>
    </aside>
  );
}

export type TocItem = { id: string; label: string };

/** Sticky contents on desktop, a scrolling row of pills on phones. */
export function Toc({ items }: { items: readonly TocItem[] }) {
  return (
    <nav className="pg-toc" aria-label="On this page">
      <p className="pg-toc-title">On this page</p>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const Chevron = (
  <svg
    className="pg-tile-arrow"
    aria-hidden="true"
    focusable="false"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** A whole-card link with a title and one line of description. */
export function Tile({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link className="pg-tile" href={href}>
      <span className="pg-tile-title">{title}</span>
      <span className="pg-tile-body">{children}</span>
      {Chevron}
    </Link>
  );
}
