import { readFile } from "node:fs/promises";
import path from "node:path";

const FILES = new Set(["maplibre-gl.mjs", "maplibre-gl-worker.mjs"]);

export function generateStaticParams() {
  return [...FILES].map((file) => ({ file }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  if (!FILES.has(file)) return new Response("Not found", { status: 404 });
  const body = await readFile(
    path.join(process.cwd(), "node_modules", "maplibre-gl", "dist", file),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
