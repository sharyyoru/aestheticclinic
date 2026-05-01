import { NextRequest, NextResponse } from "next/server";
import { fetchSentInvoices } from "@/lib/statisticsFetchers";
import {
  buildStatisticsWorkbook,
  fmtChf,
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
    if (!from || !to) {
      return NextResponse.json(
        { error: "Missing 'from' or 'to'" },
        { status: 400 },
      );
    }
    const params = {
      from,
      to,
      entityId: url.searchParams.get("entityId") || "",
      doctorId: url.searchParams.get("doctorId") || "",
      law: url.searchParams.get("law") || "",
      billingType: url.searchParams.get("billingType") || "",
      includeCancelled: url.searchParams.get("includeCancelled") === "true",
    };
    const rows = await fetchSentInvoices(params);

    const headers = [
      "Date FA",
      "No FA",
      "Annulation",
      "Date envoi email",
      "Concerne",
      "TG/TP",
      "Loi",
      "No patient",
      "Patient",
      "Entité",
      "Médecin",
      "Montant excl. TVA",
      "Montant total",
      "Statut",
      "Exonéré TVA",
      "TVA réduite (base)",
      "TVA réduite (taxe)",
      "% TVA réduite",
      "TVA complète (base)",
      "TVA complète (taxe)",
      "% TVA complète",
    ];

    const dataRows: ExcelCell[][] = rows.map((r) => [
      fmtDate(r.invoice_date),
      r.invoice_number,
      r.cancellation_flag,
      fmtDate(r.email_sent_at),
      r.invoice_title || "",
      r.billing_type || "",
      r.health_insurance_law || "",
      r.patient_id,
      `${r.patient_last_name || ""} ${r.patient_first_name || ""}`.trim(),
      r.provider_name || "",
      r.doctor_name || "",
      fmtChf(r.amount_excl_vat),
      fmtChf(r.total_amount),
      r.status,
      fmtChf(r.vat_free_amount),
      fmtChf(r.vat_reduced_taxable),
      fmtChf(r.vat_reduced_amount),
      r.vat_reduced_rate ?? "",
      fmtChf(r.vat_full_taxable),
      fmtChf(r.vat_full_amount),
      r.vat_full_rate ?? "",
    ]);

    const sum = (k: keyof (typeof rows)[number]) =>
      rows.reduce((acc, r) => acc + Number(r[k] || 0), 0);
    const totals: ExcelCell[] = [
      "Totaux",
      rows.length,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      fmtChf(sum("amount_excl_vat")),
      fmtChf(sum("total_amount")),
      "",
      fmtChf(sum("vat_free_amount")),
      fmtChf(sum("vat_reduced_taxable")),
      fmtChf(sum("vat_reduced_amount")),
      "",
      fmtChf(sum("vat_full_taxable")),
      fmtChf(sum("vat_full_amount")),
      "",
    ];

    const filename = makeFilename("Journal_des_factures", from, to);
    const buf = buildStatisticsWorkbook({
      filename,
      reportTitle: "Journal des factures (Sent Invoices)",
      filters: {
        Période: `${from} → ${to}`,
        Entité: params.entityId || "Toutes",
        Médecin: params.doctorId || "Tous",
        Loi: params.law || "Toutes",
        "TG/TP": params.billingType || "Tous",
        "Inclure annulées": params.includeCancelled ? "Oui" : "Non",
      },
      sheets: [{ name: "Détail", headers, rows: dataRows, totals }],
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
