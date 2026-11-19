import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import {
  MARK_ACCENT,
  MARK_RING,
  MARK_STROKE,
  MARK_VIEWBOX,
  MARK_WIND,
} from "./mark";

export function LogoMark({
  size = 28,
  accent = true,
  className,
}: {
  size?: number;
  /** Colours the end of the ring. Off gives a one-colour mark. */
  accent?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className ? `logo-mark ${className}` : "logo-mark"}
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={MARK_RING} />
        {MARK_WIND.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path
        d={MARK_ACCENT}
        className={accent ? "logo-accent" : undefined}
        stroke={accent ? undefined : "currentColor"}
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Mark and wordmark. Pass `href={null}` to render without a link. */
export function Logo({
  href = "/",
  size = 28,
  className,
}: {
  href?: string | null;
  size?: number;
  className?: string;
}) {
  const body = (
    <>
      <LogoMark size={size} />
      <span className="logo-word">{SITE_NAME}</span>
    </>
  );
  const classes = className ? `logo ${className}` : "logo";
  if (href === null) return <span className={classes}>{body}</span>;
  return (
    <Link href={href} className={classes} aria-label={`${SITE_NAME} home`}>
      {body}
    </Link>
  );
}
