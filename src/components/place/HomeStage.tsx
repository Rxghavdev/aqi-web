"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { PlaceReport } from "@/lib/types";
import { StationMap } from "@/components/map/StationMap";
import { bandAccent } from "@/lib/aqi";
import { PlaceReading } from "@/components/place/PlaceReading";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { TrendChart } from "@/components/trend/TrendChart";
import { readSavedPoint, type SavedPoint } from "./storage";

export function HomeStage({ ranking }: { ranking: ReactNode }) {
  const [point, setPoint] = useState<SavedPoint | null | undefined>(undefined);

  useEffect(() => {
    setPoint(readSavedPoint());
  }, []);

  return (
    <div className="desk">
      <div className="desk-main">
        {point === undefined ? (
          <HomeSkeleton />
        ) : point ? (
          <NearestReading point={point} search={<PlaceSearch />} />
        ) : (
          <AskHome />
        )}
      </div>
      {ranking}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="stage" aria-busy="true">
      <div className="stage-read">
        <div className="reading-card">
          <div className="hero is-quiet">
            <p className="sr-only">Loading the nearest station.</p>
            <div className="skeleton-numeral" aria-hidden="true" />
            <div className="skeleton-line" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="stage-map" />
    </div>
  );
}

function AskHome() {
  return (
    <div className="ask-home">
      <div className="ask-copy">
        <p className="kicker">India&apos;s official air number</p>
        <h1 className="ask-title">The monitor nearest you, on India&apos;s scale.</h1>
        <p className="lede">
          One number the government publishes. Not a guess from your street, and
          not a model dressed up as official.
        </p>
        <PlaceSearch />
      </div>
      <StationMap pins={[]} frame="ask-map" />
    </div>
  );
}

function NearestReading({
  point,
  search,
}: {
  point: SavedPoint;
  search: ReactNode;
}) {
  const [report, setReport] = useState<PlaceReport | null | "loading" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(`/api/place?lat=${encodeURIComponent(point.lat)}&lon=${encodeURIComponent(point.lon)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setReport("error");
          return;
        }
        const data: unknown = await response.json();
        if (!active) return;
        setReport(isPlace(data) ? data : null);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbort(error)) return;
        setReport("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [point.lat, point.lon]);

  if (report === "loading") return <HomeSkeleton />;

  const nearest = report && report !== "error" ? report.nearest : null;
  if (!report || report === "error" || !nearest) {
    return <AskHome />;
  }

  return (
    <PlaceReading
      report={report}
      point={{ lat: point.lat, lon: point.lon }}
      search={search}
      trend={
        <TrendChart
          kind="station"
          slug={nearest.slug}
          accent={bandAccent(nearest.band)}
        />
      }
    />
  );
}

function isPlace(data: unknown): data is PlaceReport {
  if (!data || typeof data !== "object") return false;
  const nearest = (data as { nearest?: unknown }).nearest;
  if (nearest == null) return true;
  if (typeof nearest !== "object") return false;
  const station = nearest as { slug?: unknown; name?: unknown; pollutants?: unknown };
  return typeof station.slug === "string" && typeof station.name === "string" && Array.isArray(station.pollutants);
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
