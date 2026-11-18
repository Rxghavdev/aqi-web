"use client";

import { useEffect, useState } from "react";

type Weather = {
  temperatureC: number | null;
  humidity: number | null;
  windKph: number | null;
  uvIndex: number | null;
  label: string;
};

/**
 * Current conditions beside the reading. Weather is context, never the
 * air-quality number, so a failure here leaves no gap and no message.
 */
export function WeatherCard({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const [weather, setWeather] = useState<Weather | null | "loading">("loading");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setWeather("loading");
    fetch(
      `/api/weather?lat=${encodeURIComponent(latitude.toFixed(4))}&lon=${encodeURIComponent(longitude.toFixed(4))}`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    )
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setWeather(null);
          return;
        }
        const data: unknown = await response.json();
        if (!active) return;
        setWeather(read(data));
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbort(error)) return;
        setWeather(null);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [latitude, longitude]);

  if (weather === "loading") {
    return (
      <section className="weather-card" aria-busy="true">
        <p className="sr-only">Loading the weather.</p>
        <div className="weather-skeleton" aria-hidden="true" />
      </section>
    );
  }
  if (!weather) return null;

  return (
    <section className="weather-card" aria-label="Weather at this station">
      <div className="weather-top">
        <p className="weather-temp">
          {weather.temperatureC == null ? "—" : Math.round(weather.temperatureC)}
          <span>°C</span>
        </p>
        <p className="weather-label">{weather.label}</p>
      </div>
      <dl className="weather-facts">
        <div>
          <dt>Humidity</dt>
          <dd>{weather.humidity == null ? "—" : `${Math.round(weather.humidity)}%`}</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            {weather.windKph == null ? "—" : `${weather.windKph.toFixed(1)} km/h`}
          </dd>
        </div>
        <div>
          <dt>UV</dt>
          <dd>
            {weather.uvIndex == null ? "—" : weather.uvIndex.toFixed(1)}
          </dd>
        </div>
      </dl>
      <p className="weather-note">Weather from Open-Meteo. It does not change the CPCB number.</p>
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
