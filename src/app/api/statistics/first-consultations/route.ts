import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatSwissYmd } from "@/lib/swissTimezone";

export const dynamic = "force-dynamic";

const SWISS_TZ = "Europe/Zurich";

/**
 * Parse a bracketed field from the reason string.
 * e.g. reason = " [Category: 1ère consultation] [Doctor: Xavier Tenorio] [Status: fait] [Description: ...]"
 * parseField(reason, "Doctor") → "Xavier Tenorio"
 *
 * Description can contain newlines so we use [\s\S] instead of [^\]].
 * All other fields are single-line so [^\]] is fine.
 */
function parseField(reason: string | null, field: string): string {
  if (!reason) return "";
  // Description is last and can be multi-line — use greedy match to end of string
  if (field === "Description") {
    const m = reason.match(/\[Description:\s*([\s\S]*?)\]\s*$/);
    return m ? m[1].trim() : "";
  }
  const m = reason.match(new RegExp(`\\[${field}:\\s*([^\\]]+)\\]`));
  return m ? m[1].trim() : "";
}

/**
 * Convert a Swiss calendar date (YYYY-MM-DD) to UTC ISO strings for DB filtering.
 * Switzerland is CET (UTC+1) in winter, CEST (UTC+2) in summer.
 * We pass the date as "YYYY-MM-DDT00:00:00" and let the JS Date engine
 * resolve the correct UTC offset by using Intl to find the offset.
 */
function swissDateToUtcRange(dateStr: string): { start: string; end: string } {
  // Build a Date that represents midnight Swiss time on that date
  // by finding the UTC offset for that date in Europe/Zurich
  const probe = new Date(`${dateStr}T12:00:00Z`); // noon UTC on that date
  const swissNoon = new Intl.DateTimeFormat("en-CA", {
    timeZone: SWISS_TZ,
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(probe);
  // swissNoon gives us HH:MM in Swiss time for noon UTC
  // We just need the UTC offset, so parse hours from the formatter
  const [hStr] = swissNoon.split(":");
  const swissHour = parseInt(hStr, 10);
  const offsetHours = swissHour - 12; // e.g. 13 → +1 (CET), 14 → +2 (CEST)

  const startUtc = new Date(`${dateStr}T00:00:00Z`);
  startUtc.setUTCHours(startUtc.getUTCHours() - offsetHours);

  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const doctorFilter = url.searchParams.get("doctorId") || "";

    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }

    // Convert Swiss calendar dates to UTC bounds for DB query
    const fromUtc = swissDateToUtcRange(from).start;
    const toUtc = swissDateToUtcRange(to).end;

    // Category is embedded in the reason column as "[Category: 1ère consultation]"
    // provider_id is always null for migrated appointments — all info is in reason text
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select(
        `id, reason, start_time,
         patient_id, patients!appointments_patient_id_fkey(id, first_name, last_name, email, phone, dob)`
      )
      .ilike("reason", "%[Category: 1ère consultation]%")
      .gte("start_time", fromUtc)
      .lte("start_time", toUtc)
      .not("patient_id", "is", null)
      .order("start_time", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data || [])
      .map((a: any) => {
        const reason = a.reason as string | null;
        const doctorName = parseField(reason, "Doctor");
        // Real status from the agenda (fait, Annulé, Déplacé, N'est pas venu, ...)
        const realStatus = parseField(reason, "Status");
        const description = parseField(reason, "Description");
        // Convert UTC start_time to Swiss date for display
        const swissDate = formatSwissYmd(a.start_time as string);
        return {
          appointment_id: a.id as string,
          date: swissDate,
          real_status: realStatus || "",
          doctor_name: doctorName || "Unknown",
          description,
          patient_id: a.patient_id as string,
          patient_first_name: (a.patients?.first_name as string) ?? null,
          patient_last_name: (a.patients?.last_name as string) ?? null,
          patient_email: (a.patients?.email as string) ?? null,
          patient_phone: (a.patients?.phone as string) ?? null,
          patient_dob: (a.patients?.dob as string) ?? null,
        };
      })
      .filter((r) => !doctorFilter || r.doctor_name.toLowerCase().includes(doctorFilter.toLowerCase()));

    const total = rows.length;

    const byDoctor: Record<string, { label: string; count: number }> = {};
    for (const r of rows) {
      const key = r.doctor_name;
      if (!byDoctor[key]) byDoctor[key] = { label: r.doctor_name, count: 0 };
      byDoctor[key].count++;
    }

    const byMonth: Record<string, number> = {};
    for (const r of rows) {
      const m = r.date.slice(0, 7); // YYYY-MM already in Swiss time
      byMonth[m] = (byMonth[m] ?? 0) + 1;
    }

    return NextResponse.json({
      rows,
      totals: { count: total },
      groups: {
        byDoctor: Object.entries(byDoctor)
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([key, v]) => ({ key, label: v.label, count: v.count })),
        byMonth: Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => ({ key: month, label: month, count })),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
