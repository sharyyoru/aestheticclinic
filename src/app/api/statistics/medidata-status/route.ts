import { NextResponse } from "next/server";
import { fetchMediDataStatus } from "@/lib/medidataStatusData";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "2026-04-01";
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const agingMinDays = parseInt(searchParams.get("agingMinDays") || "0", 10);

  try {
    const result = await fetchMediDataStatus(from, to, agingMinDays);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
