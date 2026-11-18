import { connection } from "next/server";
import { listMapCities } from "@/lib/report";

export async function GET() {
  await connection();
  const cities = await listMapCities();
  return Response.json(
    { cities },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
