import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** Parse "[Doctor: Xavier Tenorio]" → "Xavier Tenorio" */
function parseReasonField(reason: string | null, field: string): string {
  if (!reason) return "";
  const m = reason.match(new RegExp(`\\[${field}:\\s*([^\\]]+)\\]`));
  return m ? m[1].trim() : "";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    // doctorId filter not used since provider_id is always null in migrated data;
    // filter by doctor name parsed from reason instead
    const doctorFilter = url.searchParams.get("doctorId") || "";

    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }

    // Category is stored in the reason column as "[Category: 1ère consultation]"
    // provider_id is always null for migrated appointments — doctor is in reason text
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select(
        `id, reason, start_time,
         patient_id, patients!appointments_patient_id_fkey(id, first_name, last_name, email, phone, dob)`
      )
      .ilike("reason", "%[Category: 1ère consultation]%")
      .gte("start_time", `${from}T00:00:00+00:00`)
      .lte("start_time", `${to}T23:59:59+00:00`)
      .not("patient_id", "is", null)
      .order("start_time", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data || [])
      .map((a: any) => {
        const reason = a.reason as string | null;
        const doctorName = parseReasonField(reason, "Doctor");
        const realStatus = parseReasonField(reason, "Status") || "—";
        const description = parseReasonField(reason, "Description");
        return {
          appointment_id: a.id as string,
          date: (a.start_time as string).slice(0, 10),
          real_status: realStatus,
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
      // Apply doctor name filter if a doctorId (name) was provided via the filter bar
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
      const m = r.date.slice(0, 7);
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
