"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** The current year. Server markup uses a fixed year so prerendering stays static. */
export function Year() {
  const year = useSyncExternalStore(
    noop,
    () => new Date().getFullYear(),
    () => 2026,
  );
  return <>{year}</>;
}
