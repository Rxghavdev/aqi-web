import { connection } from "next/server";
import { listCities } from "@/lib/report";

export async function GET() {
  await connection();
  const cities = await listCities();
  return Response.json(cities, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
