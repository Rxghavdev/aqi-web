"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_LINKS } from "./links";

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Primary">
      {PRIMARY_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone navigation: a menu button that opens a full-width list under the header. */
export function MobileNav() {
  const pathname = usePathname();
  const panelId = useId();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const open = openFor === pathname;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenFor(null);
    }
    function onPointer(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpenFor(null);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="mobile-nav" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenFor(open ? null : pathname)}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
          className="menu-icon"
          data-open={open}
        >
          <path className="menu-bar-top" d="M4 8h16" />
          <path className="menu-bar-bottom" d="M4 16h16" />
        </svg>
      </button>
      <nav id={panelId} className="mobile-nav-panel" aria-label="Primary" hidden={!open}>
        {PRIMARY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
            onClick={() => setOpenFor(null)}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
