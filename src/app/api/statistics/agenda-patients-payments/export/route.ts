import { NextRequest, NextResponse } from "next/server";
import { fetchAgendaPatientsPayments } from "@/lib/statisticsFetchers";
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
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }
    const agenda = url.searchParams.get("agenda") || "";

    const { rows, groups, totals } = await fetchAgendaPatientsPayments({
      from,
      to,
      agenda,
    });

    // ── Sheet 1: Detail rows ────────────────────────────────────────────────
    const detailHeaders = [
      "Date paiement",
      "Méthode",
      "Montant payé",
      "No FA",
      "Date FA",
      "Montant FA",
      "Statut",
      "Patient",
      "Email",
      "Téléphone",
      "Notes",
    ];
    const detailRows: ExcelCell[][] = rows.map((r) => [
      fmtDate(r.payment_date),
      r.payment_method || "",
      fmtChf(r.amount),
      r.invoice_number,
      fmtDate(r.invoice_date),
      fmtChf(r.invoice_total),
      r.invoice_status,
      `${r.patient_last_name || ""} ${r.patient_first_name || ""}`.trim(),
      r.patient_email || "",
      r.patient_phone || "",
      r.notes || "",
    ]);
    const detailTotals: ExcelCell[] = [
      "Totaux",
      "",
      fmtChf(totals.totalPaid),
      "",
      "",
      fmtChf(totals.totalBilled),
      "",
      "",
      "",
      "",
      "",
    ];

    // ── Sheet 2: By patient ────────────────────────────────────────────────
    const patientHeaders = ["Patient", "Email", "Téléphone", "Factures", "Montant FA", "Montant payé"];
    const patientRows: ExcelCell[][] = groups.byPatient.map((p) => [
      p.label,
      p.email || "",
      p.phone || "",
      p.invoiceCount,
      fmtChf(p.totalBilled),
      fmtChf(p.totalPaid),
    ]);
    const patientTotals: ExcelCell[] = [
      "Totaux",
      "",
      "",
      totals.invoiceCount,
      fmtChf(totals.totalBilled),
      fmtChf(totals.totalPaid),
    ];

    // ── Sheet 3: By month ──────────────────────────────────────────────────
    const monthHeaders = ["Mois", "Patients", "Factures", "Montant FA", "Montant payé"];
    const monthRows: ExcelCell[][] = groups.byMonth.map((m) => [
      m.label,
      m.patientCount,
      m.invoiceCount,
      fmtChf(m.totalBilled),
      fmtChf(m.totalPaid),
    ]);

    // ── Sheet 4: By payment method ─────────────────────────────────────────
    const methodHeaders = ["Méthode", "Patients", "Factures", "Montant FA", "Montant payé"];
    const methodRows: ExcelCell[][] = groups.byPaymentMethod.map((m) => [
      m.label,
      m.patientCount,
      m.invoiceCount,
      fmtChf(m.totalBilled),
      fmtChf(m.totalPaid),
    ]);

    const filename = makeFilename("Paiements_Agenda", from, to);
    const buf = buildStatisticsWorkbook({
      filename,
      reportTitle: "Paiements des patients par agenda",
      filters: {
        Période: `${from} → ${to}`,
        Agenda: agenda || "Tous",
      },
      sheets: [
        { name: "Détail", headers: detailHeaders, rows: detailRows, totals: detailTotals },
        { name: "Par patient", headers: patientHeaders, rows: patientRows, totals: patientTotals },
        { name: "Par mois", headers: monthHeaders, rows: monthRows },
        { name: "Par méthode", headers: methodHeaders, rows: methodRows },
      ],
    });

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
