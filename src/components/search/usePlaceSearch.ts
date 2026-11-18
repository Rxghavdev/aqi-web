"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/lib/types";
import { parseHits } from "./hits";

export type SearchStatus = "idle" | "loading" | "ready" | "empty" | "error";

/**
 * Debounced, abortable place search against /api/search. Powers both the home
 * field and the header palette so the two always behave the same.
 */
export function usePlaceSearch() {
  const [query, setQueryState] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const load = useCallback(async (q: string, signal: AbortSignal, request: number) => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal,
        headers: { accept: "application/json" },
      });
      if (signal.aborted || request !== requestRef.current) return;
      if (!response.ok) {
        setHits([]);
        setStatus("error");
        return;
      }
      const data: unknown = await response.json();
      if (signal.aborted || request !== requestRef.current) return;
      const next = parseHits(data);
      setHits(next);
      setStatus(next.length === 0 ? "empty" : "ready");
    } catch (error) {
      if (signal.aborted || request !== requestRef.current) return;
      if (error instanceof Error && error.name === "AbortError") return;
      setHits([]);
      setStatus("error");
    }
  }, []);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
      const request = ++requestRef.current;
      const q = value.trim();
      if (!q) {
        setHits([]);
        setStatus("idle");
        return;
      }
      setStatus("loading");
      timerRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortRef.current = controller;
        void load(q, controller.signal, request);
      }, 180);
    },
    [load],
  );

  const reset = useCallback(() => setQuery(""), [setQuery]);

  return { query, setQuery, reset, hits, status };
}
