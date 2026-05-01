import { NextRequest, NextResponse } from "next/server";
import { fetchServiceLines } from "../route";
import {
  buildStatisticsWorkbook,
  fmtChf,
  fmtDate,
  makeFilename,
  type ExcelCell,
} from "@/lib/statisticsExcel";
import type { ServiceLineRow } from "@/lib/statisticsAggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return exportServices(req, {
    dateField: "invoice_date",
    paidStatusOnly: false,
    reportTitle: "Prestations facturées (Invoiced Services)",
    filename: "Prestations_facturees",
  });
}

export async function exportServices(
  req: NextRequest,
  cfg: {
    dateField: "invoice_date" | "paid_at";
    paidStatusOnly: boolean;
    reportTitle: string;
    filename: string;
  },
) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }
    const params = {
      from,
      to,
      entityId: url.searchParams.get("entityId") || "",
      doctorId: url.searchParams.get("doctorId") || "",
      law: url.searchParams.get("law") || "",
      billingType: url.searchParams.get("billingType") || "",
      includeCancelled: url.searchParams.get("includeCancelled") === "true",
      dateField: cfg.dateField,
      paidStatusOnly: cfg.paidStatusOnly,
    };
    const rows: ServiceLineRow[] = await fetchServiceLines(params);

    const headers = [
      "Date FA",
      "Date paiement",
      "No FA",
      "Statut FA",
      "Entité",
      "Médecin",
      "No patient",
      "Loi",
      "TG/TP",
      "Catalogue",
      "Code tarif",
      "Code",
      "Désignation",
      "Quantité",
      "Prix unitaire",
      "Total ligne",
      "Montant payé (ligne)",
      "Type TVA",
      "% TVA",
      "Montant TVA",
    ];

    const dataRows: ExcelCell[][] = rows.map((r) => [
      fmtDate(r.invoice_date),
      fmtDate(r.paid_at),
      r.invoice_number,
      r.invoice_status,
      r.provider_name || "",
      r.doctor_name || "",
      r.patient_id,
      r.health_insurance_law || "",
      r.billing_type || "",
      r.catalog_name || "",
      r.tariff_code ?? "",
      r.code || "",
      r.line_name,
      r.quantity,
      fmtChf(r.unit_price),
      fmtChf(r.total_price),
      fmtChf(r.line_paid_amount),
      r.vat_rate || "",
      r.vat_rate_value ?? "",
      fmtChf(r.vat_amount),
    ]);

    const sum = (k: keyof ServiceLineRow) =>
      rows.reduce((acc, r) => acc + Number(r[k] || 0), 0);
    const totals: ExcelCell[] = [
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
      "",
      "",
      "",
      "",
      fmtChf(sum("total_price")),
      fmtChf(sum("line_paid_amount")),
      "",
      "",
      fmtChf(sum("vat_amount")),
    ];

    const filename = makeFilename(cfg.filename, from, to);
    const buf = buildStatisticsWorkbook({
      filename,
      reportTitle: cfg.reportTitle,
      filters: {
        Période: `${from} → ${to}`,
        Entité: params.entityId || "Toutes",
        Médecin: params.doctorId || "Tous",
        Loi: params.law || "Toutes",
        "TG/TP": params.billingType || "Tous",
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
