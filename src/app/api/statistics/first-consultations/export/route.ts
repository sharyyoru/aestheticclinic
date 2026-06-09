import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatSwissYmd } from "@/lib/swissTimezone";
import {
  buildStatisticsWorkbook,
  fmtDate,
  makeFilename,
  type ExcelCell,
} from "@/lib/statisticsExcel";

export const dynamic = "force-dynamic";

const SWISS_TZ = "Europe/Zurich";

function parseField(reason: string | null, field: string): string {
  if (!reason) return "";
  if (field === "Description") {
    const m = reason.match(/\[Description:\s*([\s\S]*?)\]\s*$/);
    return m ? m[1].trim() : "";
  }
  const m = reason.match(new RegExp(`\\[${field}:\\s*([^\\]]+)\\]`));
  return m ? m[1].trim() : "";
}

function swissDateToUtcRange(dateStr: string): { start: string; end: string } {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const swissNoon = new Intl.DateTimeFormat("en-CA", {
    timeZone: SWISS_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(probe);
  const offsetHours = parseInt(swissNoon.split(":")[0], 10) - 12;
  const startUtc = new Date(`${dateStr}T00:00:00Z`);
  startUtc.setUTCHours(startUtc.getUTCHours() - offsetHours);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start: startUtc.toISOString(), end: endUtc.toISOString() };
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

    const fromUtc = swissDateToUtcRange(from).start;
    const toUtc = swissDateToUtcRange(to).end;

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
        const realStatus = parseField(reason, "Status");
        const description = parseField(reason, "Description");
        const swissDate = formatSwissYmd(a.start_time as string);
        return {
          appointment_id: a.id as string,
          date: swissDate,
          real_status: realStatus || "",
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
      r.date, // already YYYY-MM-DD in Swiss time
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
