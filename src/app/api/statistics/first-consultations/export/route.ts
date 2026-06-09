import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildStatisticsWorkbook,
  fmtDate,
  makeFilename,
  type ExcelCell,
} from "@/lib/statisticsExcel";

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

    let q = supabaseAdmin
      .from("appointments")
      .select(
        `id, title, start_time, status,
         provider_id, providers!appointments_provider_id_fkey(id, name),
         patient_id, patients!appointments_patient_id_fkey(id, first_name, last_name, email, phone, dob)`
      )
      .ilike("title", "%1ère%")
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
      appointment_id: a.id as string,
      date: (a.start_time as string).slice(0, 10),
      status: a.status as string,
      doctor_name: (a.providers?.name as string) ?? "",
      patient_id: a.patient_id as string,
      patient_first_name: (a.patients?.first_name as string) ?? "",
      patient_last_name: (a.patients?.last_name as string) ?? "",
      patient_email: (a.patients?.email as string) ?? "",
      patient_phone: (a.patients?.phone as string) ?? "",
      patient_dob: (a.patients?.dob as string) ?? "",
    }));

    const headers = [
      "Date",
      "Statut RDV",
      "Médecin",
      "No patient",
      "Nom",
      "Prénom",
      "Date de naissance",
      "Email",
      "Téléphone",
    ];

    const dataRows: ExcelCell[][] = rows.map((r) => [
      fmtDate(r.date),
      r.status,
      r.doctor_name,
      r.patient_id,
      r.patient_last_name,
      r.patient_first_name,
      r.patient_dob ? fmtDate(r.patient_dob) : "",
      r.patient_email,
      r.patient_phone,
    ]);

    const totals: ExcelCell[] = [
      "Total",
      rows.length,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    const filename = makeFilename("Premieres_Consultations", from, to);
    const buf = buildStatisticsWorkbook({
      filename,
      reportTitle: "1ères Consultations — Nouveaux patients",
      filters: {
        Période: `${from} → ${to}`,
        Médecin: doctorId || "Tous",
      },
      sheets: [
        {
          name: "1ères Consultations",
          headers,
          rows: dataRows,
          totals,
          columnWidths: [12, 14, 22, 36, 20, 20, 14, 28, 16],
        },
      ],
    });

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
