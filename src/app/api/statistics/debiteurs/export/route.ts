import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildStatisticsWorkbook,
  fmtChf,
  fmtDate,
  makeFilename,
} from "@/lib/statisticsExcel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const asOf = url.searchParams.get("asOf");
    const entityId = url.searchParams.get("entityId") || "";
    const doctorId = url.searchParams.get("doctorId") || "";
    const law = url.searchParams.get("law") || "";
    const billingType = url.searchParams.get("billingType") || "";
    const minLevelStr = url.searchParams.get("minLevel");
    const minLevel = minLevelStr ? Number(minLevelStr) : 0;

    let q = supabaseAdmin
      .from("v_debiteurs")
      .select("*")
      .eq("is_demo", false)
      .eq("is_archived", false)
      .gte("reminder_level", minLevel)
      .order("invoice_date", { ascending: false })
      .limit(20000);

    if (entityId) q = q.eq("provider_id", entityId);
    if (doctorId) q = q.eq("doctor_user_id", doctorId);
    if (law) q = q.eq("health_insurance_law", law);
    if (billingType) q = q.eq("billing_type", billingType);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = data || [];
    if (asOf) {
      rows = rows.filter((r) => (r.invoice_date as string) <= asOf);
    }

    const headers = [
      "Entité",
      "ZSR",
      "Date FA",
      "Date d'échéance",
      "No FA",
      "Concerne",
      "No patient",
      "Patient",
      "Email",
      "Loi",
      "TG/TP",
      "Montant total",
      "Payé",
      "Frais de rappels",
      "Montant ouvert",
      "Perte",
      "Niveau de rappel",
      "Statut",
      "Jours en retard",
      "Médecin",
    ];

    const dataRows = rows.map((r) => [
      r.provider_name ?? "",
      r.provider_zsr ?? "",
      fmtDate(r.invoice_date as string),
      fmtDate(r.due_date as string | null),
      r.invoice_number ?? "",
      r.invoice_title ?? "",
      r.patient_id ?? "",
      `${r.last_name ?? ""} ${r.first_name ?? ""}`.trim(),
      r.patient_email ?? "",
      r.health_insurance_law ?? "",
      r.billing_type ?? "",
      fmtChf(r.total_amount as number),
      fmtChf(r.paid_amount as number),
      fmtChf(r.reminder_fees as number),
      fmtChf(r.open_amount as number),
      fmtChf(r.loss_amount as number),
      r.reminder_level ?? 0,
      r.status ?? "",
      r.days_overdue ?? 0,
      r.doctor_name ?? "",
    ]);

    // Totals row
    const sum = (key: string) =>
      rows.reduce((acc, r) => acc + Number((r as Record<string, unknown>)[key] || 0), 0);
    const totalsRow = [
      "Totaux",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      fmtChf(sum("total_amount")),
      fmtChf(sum("paid_amount")),
      fmtChf(sum("reminder_fees")),
      fmtChf(sum("open_amount")),
      fmtChf(sum("loss_amount")),
      "",
      "",
      "",
      "",
    ];

    const filename = makeFilename(
      "Debiteurs",
      undefined,
      asOf || new Date().toISOString().slice(0, 10),
    );

    const buf = buildStatisticsWorkbook({
      filename,
      reportTitle: "Debiteurs - Liste des factures ouvertes",
      filters: {
        "Date de référence": asOf || new Date().toISOString().slice(0, 10),
        "Entité (filtre)": entityId || "Toutes",
        "Médecin (filtre)": doctorId || "Tous",
        Loi: law || "Toutes",
        "TG/TP": billingType || "Tous",
        "Niveau de rappel min.": minLevel,
      },
      sheets: [
        {
          name: "Debiteurs",
          headers,
          rows: dataRows,
          totals: totalsRow,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
