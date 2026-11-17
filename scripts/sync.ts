import { readFileSync } from "node:fs";
import path from "node:path";
import { getLastCpcbFetchInfo } from "../src/lib/sources/cpcb.ts";
import { refreshSnapshot } from "../src/lib/snapshot.ts";

loadEnvLocal(path.join(process.cwd(), ".env.local"));

try {
  const snapshot = await refreshSnapshot(true);
  const delhiCity = snapshot.cities.find(
    (city) =>
      city.city.toLowerCase() === "delhi" && city.state.toLowerCase() === "delhi",
  );
  const delhiStation = snapshot.stations
    .filter(
      (station) =>
        station.city.toLowerCase() === "delhi" &&
        station.state.toLowerCase() === "delhi" &&
        station.aqi != null,
    )
    .sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0))[0];
  const fetchInfo = getLastCpcbFetchInfo();

  console.log(`stations: ${snapshot.stations.length}`);
  console.log(`cities: ${snapshot.cities.length}`);
  if (delhiCity) {
    console.log(
      `Delhi city AQI: ${delhiCity.aqi ?? "null"}${delhiCity.band ? ` ${delhiCity.band}` : ""}`,
    );
  }
  if (delhiStation) {
    console.log(`Delhi station: ${delhiStation.name} ${delhiStation.aqi}`);
  } else {
    console.log("Delhi station: none with a numeric AQI");
  }
  if (fetchInfo) {
    console.log(
      `page size: ${fetchInfo.pageSize} (requested ${fetchInfo.requestedLimit}), pages ${fetchInfo.pages}, feed rows ${fetchInfo.total}`,
    );
  }
} catch (error) {
  const key = process.env.DATA_GOV_API_KEY ?? "";
  const message = error instanceof Error ? error.message : String(error);
  console.error(key ? message.split(key).join("[redacted]") : message);
  process.exitCode = 1;
}

function loadEnvLocal(file: string): void {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}
