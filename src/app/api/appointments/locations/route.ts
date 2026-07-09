import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Returns the distinct agenda names used in the legacy calendar system.
 *
 * The old calendar embedded the agenda/resource name in the `reason` text field
 * as  [Doctor: <AgendaName>]  — e.g. "[Doctor: Montreux]", "[Doctor: GSTAAD AESTH]".
 * We parse all distinct names from that token so the UI can populate the dropdown.
 *
 * Only names that appear on at least MIN_COUNT appointments are returned to
 * filter out one-off typos / test entries.
 */

const MIN_COUNT = 5;

export async function GET() {
  try {
    // Fetch all appointment reason strings that contain a [Doctor: X] token.
    // We paginate to avoid hitting Supabase's default 1 000-row limit.
    const nameCounts = new Map<string, number>();
    const PAGE = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from("appointments")
        .select("reason")
        .ilike("reason", "%[Doctor:%")
        .not("patient_id", "is", null)
        .range(offset, offset + PAGE - 1);

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;

      for (const row of data) {
        const matches = row.reason?.matchAll(/\[Doctor: ([^\]]+)\]/g);
        if (matches) {
          for (const m of matches) {
            const name = m[1].trim();
            nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
          }
        }
      }

      if (data.length < PAGE) break;
      offset += PAGE;
      if (offset > 200_000) break;
    }

    const agendas = [...nameCounts.entries()]
      .filter(([, count]) => count >= MIN_COUNT)
      .sort((a, b) => b[1] - a[1]) // most-used first
      .map(([name]) => name);

    return NextResponse.json({ agendas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
