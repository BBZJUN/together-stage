import { connection } from "next/server";
import { getParking } from "@/lib/parking";

export async function GET() {
  await connection(); // 매 요청마다 최신 주차 현황
  return Response.json(await getParking());
}
