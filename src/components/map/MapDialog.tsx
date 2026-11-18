"use client";

import { useEffect, useId, useRef, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A near-full-screen modal for the expanded map. The native <dialog> gives a
 * focus trap, an inert page behind it and Esc handling. This adds the body
 * scroll lock and puts focus back on whatever opened it.
 *
 * `escapeRef` lets the map inside claim Esc first: if a pin card is open, the
 * first Esc closes the card and the next one closes the dialog.
 */
export function MapDialog({
  title,
  onClose,
  escapeRef,
  openerRef,
  children,
}: {
  title: string;
  onClose: () => void;
  escapeRef: MutableRefObject<(() => boolean) | null>;
  /** The button that opened the dialog. Safari does not focus buttons on click. */
  openerRef: MutableRefObject<HTMLElement | null>;
  children: (closeButton: ReactNode) => ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener =
      openerRef.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const body = document.body;
    const previous = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    if (!dialog.open) dialog.showModal();

    const onCancel = (event: Event) => {
      event.preventDefault();
      if (escapeRef.current?.()) return;
      closeRef.current();
    };
    dialog.addEventListener("cancel", onCancel);

    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      // Wait a frame so the page is interactive again before focus moves.
      window.requestAnimationFrame(() => {
        if (opener?.isConnected) opener.focus();
      });
    };
  }, [escapeRef, openerRef]);

  const closeButton = (
    <button type="button" className="map-btn map-dialog-close" onClick={onClose} aria-label="Close map">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3.5 3.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );

  return createPortal(
    <dialog
      ref={dialogRef}
      className="map-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <h2 id={titleId} className="sr-only">
        {title}
      </h2>
      {children(closeButton)}
    </dialog>,
    document.body,
  );
}
