import { connection } from "next/server";
import { getSnapshotMeta } from "@/lib/report";

export async function GET() {
  await connection();
  const meta = await getSnapshotMeta();
  return Response.json(meta);
}
