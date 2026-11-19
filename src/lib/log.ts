/**
 * One-line structured JSON logs. Written to stdout so a host can ship them
 * as-is. Values are truncated and the data.gov.in key is scrubbed, so a log
 * line cannot carry a secret even when an error message embeds a URL.
 */

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const MAX_STRING = 300;

function secrets(): string[] {
  const values: string[] = [];
  for (const name of ["DATA_GOV_API_KEY"]) {
    const value = process.env[name]?.trim();
    if (value && value.length >= 6) values.push(value);
  }
  return values;
}

export function scrub(text: string): string {
  let out = text;
  for (const secret of secrets()) out = out.split(secret).join("[redacted]");
  out = out.replace(/(api-key=)[^&\s"']+/gi, "$1[redacted]");
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}…` : out;
}

/** A short, secret-free description of anything thrown. */
export function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
    return scrub(`${error.name}: ${error.message}${cause}`);
  }
  return scrub(String(error));
}

function clean(value: unknown): unknown {
  if (typeof value === "string") return scrub(value);
  if (value instanceof Error) return errorText(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  return scrub(String(value));
}

export function formatLog(level: Level, event: string, fields: Fields = {}): string {
  const body: Fields = {};
  for (const [key, value] of Object.entries(fields)) body[key] = clean(value);
  return JSON.stringify({ t: new Date().toISOString(), level, event, ...body });
}

export function log(level: Level, event: string, fields?: Fields): void {
  const line = formatLog(level, event, fields);
  if (level === "info") console.log(line);
  else console.error(line);
}

export const logInfo = (event: string, fields?: Fields) => log("info", event, fields);
export const logWarn = (event: string, fields?: Fields) => log("warn", event, fields);
export const logError = (event: string, fields?: Fields) => log("error", event, fields);
