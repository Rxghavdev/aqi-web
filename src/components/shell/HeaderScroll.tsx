"use client";

import { useEffect } from "react";

/** Marks the header once the page has scrolled, for the blur and hairline. */
export function HeaderScroll({ targetId }: { targetId: string }) {
  useEffect(() => {
    const header = document.getElementById(targetId);
    if (!header) return;
    let frame = 0;
    function update() {
      frame = 0;
      header?.toggleAttribute("data-scrolled", window.scrollY > 4);
    }
    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [targetId]);
  return null;
}
