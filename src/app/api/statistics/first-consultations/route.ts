import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const doctorId = url.searchParams.get("doctorId") || "";

    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }

    // Match "1ère Consultation" (French) and "First Consultation" (English)
    let q = supabaseAdmin
      .from("appointments")
      .select(
        `id, title, start_time, status,
         provider_id, providers!appointments_provider_id_fkey(id, name),
         patient_id, patients!appointments_patient_id_fkey(id, first_name, last_name, email, phone, dob)`
      )
      .or("title.ilike.%1ère%,title.ilike.%1ere%,title.ilike.%First Consultation%")
      .gte("start_time", `${from}T00:00:00+00:00`)
      .lte("start_time", `${to}T23:59:59+00:00`)
      .not("patient_id", "is", null)
      .order("start_time", { ascending: true });

    if (doctorId) {
      q = q.eq("provider_id", doctorId);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data || []).map((a: any) => ({
      appointment_id: a.id,
      date: (a.start_time as string).slice(0, 10),
      status: a.status,
      doctor_id: a.provider_id,
      doctor_name: a.providers?.name ?? null,
      patient_id: a.patient_id,
      patient_first_name: a.patients?.first_name ?? null,
      patient_last_name: a.patients?.last_name ?? null,
      patient_email: a.patients?.email ?? null,
      patient_phone: a.patients?.phone ?? null,
      patient_dob: a.patients?.dob ?? null,
    }));

    // KPI summary
    const total = rows.length;
    const byDoctor: Record<string, { label: string; count: number }> = {};
    for (const r of rows) {
      const key = r.doctor_id ?? "__none__";
      if (!byDoctor[key]) byDoctor[key] = { label: r.doctor_name ?? "Unknown", count: 0 };
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
        byDoctor: Object.entries(byDoctor).map(([key, v]) => ({
          key,
          label: v.label,
          count: v.count,
        })),
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
