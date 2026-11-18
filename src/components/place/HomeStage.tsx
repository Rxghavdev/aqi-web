"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { bandAccent } from "@/lib/aqi";
import type { PlaceReport } from "@/lib/types";
import { AqiFigure } from "@/components/reading/AqiFigure";
import { CityAverageLink } from "@/components/reading/CityAverageLink";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { meterRows, PollutantMeters } from "@/components/reading/PollutantMeters";
import { SpikeStrip } from "@/components/reading/SpikeStrip";
import { officialStation, pollutantLabel, stationPath } from "@/components/reading/text";
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
        {point === undefined ? <HomeSkeleton /> : point ? <NearestReading point={point} /> : <AskHome />}
      </div>
      {ranking}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="hero is-quiet" aria-busy="true">
      <p className="sr-only">Loading the nearest station.</p>
      <div className="skeleton-numeral" aria-hidden="true" />
      <div className="skeleton-line" aria-hidden="true" />
    </div>
  );
}

function AskHome() {
  return (
    <div className="ask-home">
      <p className="kicker">India&apos;s official air number</p>
      <h1 className="ask-title">The monitor nearest you, on India&apos;s scale.</h1>
      <PlaceSearch />
    </div>
  );
}

function NearestReading({ point }: { point: SavedPoint }) {
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

  if (report === "loading") {
    return (
      <div className="hero is-quiet" aria-busy="true">
        <p className="sr-only">Loading the nearest station.</p>
        <div className="skeleton-numeral" aria-hidden="true" />
        <div className="skeleton-line" aria-hidden="true" />
      </div>
    );
  }

  const nearest = report && report !== "error" ? report.nearest : null;
  if (!report || report === "error" || !nearest) {
    return (
      <div className="ask-home">
        <p className="kicker">India&apos;s official air number</p>
        <h1 className="ask-title">The monitor nearest you, on India&apos;s scale.</h1>
        <p className="lede">No CPCB reading is available for this location yet.</p>
        <PlaceSearch />
      </div>
    );
  }

  const official = officialStation(nearest);
  const meters = meterRows(nearest.pollutants);
  return (
    <>
      <div className="reading-top">
        <section className={heroClass(official.band)} style={heroStyle(official.band)}>
          <p className="hero-kicker">
            {nearest.city}
            <span aria-hidden="true"> · </span>
            {nearest.state}
          </p>
          <h1 className="hero-name">
            <Link href={stationPath(nearest.slug)}>{nearest.name}</Link>
          </h1>
          <AqiFigure
            aqi={official.aqi}
            band={official.band}
            updatedAt={nearest.updatedAt}
            missing="words"
          />
        </section>
        <div className="reading-side">
          <section className="paper-card">
            {report.distanceKm != null && Number.isFinite(report.distanceKm) ? (
              <p className="hero-distance">{report.distanceKm.toFixed(1)} km from you</p>
            ) : null}
            {nearest.prominent ? <p>Set by {pollutantLabel(nearest.prominent)}</p> : null}
            {report.city ? (
              <CityAverageLink city={report.city} />
            ) : (
              <p className="fact-row">
                <Link className="fact-link" href={stationPath(nearest.slug)}>
                  Open this station
                </Link>
              </p>
            )}
          </section>
        </div>
      </div>
      {meters.length > 0 ? (
        <section className="paper-card">
          <PollutantMeters pollutants={nearest.pollutants} />
          <p className="meters-note">These are index points, not concentrations.</p>
        </section>
      ) : null}
      <SpikeStrip spike={report.spike} />
      <TrendChart kind="station" slug={nearest.slug} accent={bandAccent(official.band)} />
      <PlaceSearch />
    </>
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
