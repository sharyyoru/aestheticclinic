import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildStatisticsWorkbook,
  fmtDate,
  makeFilename,
  type ExcelCell,
} from "@/lib/statisticsExcel";

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
    const doctorFilter = url.searchParams.get("doctorId") || "";

    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }

    // Category is stored in the reason column as "[Category: 1ère consultation]"
    // provider_id is always null for migrated appointments — doctor name is in reason text
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
          patient_first_name: (a.patients?.first_name as string) ?? "",
          patient_last_name: (a.patients?.last_name as string) ?? "",
          patient_email: (a.patients?.email as string) ?? "",
          patient_phone: (a.patients?.phone as string) ?? "",
          patient_dob: (a.patients?.dob as string) ?? "",
        };
      })
      .filter((r) => !doctorFilter || r.doctor_name.toLowerCase().includes(doctorFilter.toLowerCase()));

    const headers = [
      "Date",
      "Statut",
      "Médecin",
      "No patient",
      "Nom",
      "Prénom",
      "Date de naissance",
      "Email",
      "Téléphone",
      "Description / Notes",
    ];

    const dataRows: ExcelCell[][] = rows.map((r) => [
      fmtDate(r.date),
      r.real_status,
      r.doctor_name,
      r.patient_id,
      r.patient_last_name,
      r.patient_first_name,
      r.patient_dob ? fmtDate(r.patient_dob) : "",
      r.patient_email,
      r.patient_phone,
      r.description,
    ]);

    const totals: ExcelCell[] = ["Total", rows.length, "", "", "", "", "", "", "", ""];

    const filename = makeFilename("Premieres_Consultations", from, to);
    const buf = buildStatisticsWorkbook({
      filename,
      reportTitle: "1ères Consultations — Nouveaux patients",
      filters: {
        Période: `${from} → ${to}`,
        Médecin: doctorFilter || "Tous",
      },
      sheets: [
        {
          name: "1ères Consultations",
          headers,
          rows: dataRows,
          totals,
          columnWidths: [12, 14, 22, 36, 20, 20, 14, 28, 16, 40],
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
