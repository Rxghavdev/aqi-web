"use client";

import { useEffect, useState } from "react";
import { Icon, weatherIconName } from "./icons";

type Weather = {
  temperatureC: number | null;
  humidity: number | null;
  windKph: number | null;
  uvIndex: number | null;
  label: string;
  code: number | null;
};

/**
 * Current conditions beside the reading. The card reserves its final height
 * while loading, and a failed request removes it without a message: weather
 * is context, never part of the AQI.
 */
export function WeatherCard({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const [result, setResult] = useState<{
    key: string;
    weather: Weather | null;
  } | null>(null);
  const weather: Weather | null | "loading" =
    result && result.key === key ? result.weather : "loading";

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(
      `/api/weather?lat=${encodeURIComponent(latitude.toFixed(4))}&lon=${encodeURIComponent(longitude.toFixed(4))}`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    )
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setResult({ key, weather: null });
          return;
        }
        const data: unknown = await response.json();
        if (!active) return;
        setResult({ key, weather: read(data) });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbort(error)) return;
        setResult({ key, weather: null });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, latitude, longitude]);

  if (weather === "loading") {
    return (
      <section className="weather" aria-busy="true" aria-label="Weather">
        <p className="sr-only">Loading the weather.</p>
        <div className="weather-skeleton" aria-hidden="true" />
      </section>
    );
  }
  if (!weather) return null;

  return (
    <section className="weather" aria-label="Weather at this station">
      <div className="weather-top">
        <span className="weather-icon">
          <Icon name={weatherIconName(weather.code, weather.label)} size={30} />
        </span>
        <p className="weather-temp">
          {weather.temperatureC == null
            ? "—"
            : Math.round(weather.temperatureC)}
          <span>°C</span>
        </p>
        <p className="weather-label">{weather.label}</p>
      </div>
      <dl className="weather-facts">
        <div>
          <dt>
            <Icon name="droplet" size={15} />
            Humidity
          </dt>
          <dd>
            {weather.humidity == null
              ? "—"
              : `${Math.round(weather.humidity)}%`}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="wind" size={15} />
            Wind
          </dt>
          <dd>
            {weather.windKph == null
              ? "—"
              : `${Math.round(weather.windKph)} km/h`}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="uv" size={15} />
            UV peak
          </dt>
          <dd>{weather.uvIndex == null ? "—" : weather.uvIndex.toFixed(1)}</dd>
        </div>
      </dl>
      <p className="weather-note">Weather by Open-Meteo</p>
    </section>
  );
}

function read(data: unknown): Weather | null {
  if (!data || typeof data !== "object") return null;
  const record = (data as { weather?: unknown }).weather;
  if (!record || typeof record !== "object") return null;
  const item = record as Record<string, unknown>;
  const num = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const weather: Weather = {
    temperatureC: num(item.temperatureC),
    humidity: num(item.humidity),
    windKph: num(item.windKph),
    uvIndex: num(item.uvIndex),
    label: typeof item.label === "string" ? item.label : "Conditions",
    code: num(item.code),
  };
  if (
    weather.temperatureC == null &&
    weather.humidity == null &&
    weather.windKph == null
  ) {
    return null;
  }
  return weather;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
