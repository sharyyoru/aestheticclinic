import { NextRequest, NextResponse } from "next/server";
import { fetchAgendaPatientsPayments } from "@/lib/statisticsFetchers";

export const dynamic = "force-dynamic";

/**
 * Patients who appeared in a given agenda (location) and how much they paid
 * during a specific date range.
 *
 * Example: patients from the "Montreux" agenda who paid Jan – Jun 2026.
 *
 * "Agenda" maps to the `location` column in the `appointments` table.
 * Legacy (migrated) appointments store agenda name there too.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }
    const agenda = url.searchParams.get("agenda") || "";

    const result = await fetchAgendaPatientsPayments({ from, to, agenda });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
