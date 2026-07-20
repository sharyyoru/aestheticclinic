import { NextRequest, NextResponse } from "next/server";
import {
  buildStatisticsWorkbook,
  fmtChf,
  makeFilename,
} from "@/lib/statisticsExcel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || "2026-04-01";
    const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
    const agingMinDays = parseInt(url.searchParams.get("agingMinDays") || "0", 10);

    // Fetch data from the main API route (internal fetch)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const apiUrl = `${baseUrl}/api/statistics/medidata-status?from=${from}&to=${to}&agingMinDays=${agingMinDays}`;
    const resp = await fetch(apiUrl, { cache: "no-store" });
    if (!resp.ok) {
      return NextResponse.json({ error: `Failed to fetch data: ${resp.status}` }, { status: 500 });
    }
    const data = await resp.json();

    const s = data.summary || {};
    const ab = data.agingBuckets || {};
    const aa = data.agingAmounts || {};
    const rows: any[] = data.rows || [];

    // ── Sheet 1: Summary ──
    const summaryRows: (string | number)[][] = [
      ["Total Invoices", s.total_invoices || 0],
      ["Total Amount (CHF)", fmtChf(s.total_amount)],
      ["Sent to MediData", s.sent || 0],
      ["Sent Amount (CHF)", fmtChf(s.sent_amount)],
      ["Not Sent", s.not_sent || 0],
      ["Not Sent Amount (CHF)", fmtChf(s.not_sent_amount)],
      ["", ""],
      ["Submission Status", "Count", "Amount (CHF)"],
      ["Paid", s.paid || 0, fmtChf(s.paid_amount)],
      ["Rejected", s.rejected || 0, fmtChf(s.rejected_amount)],
      ["Transmitted (Pending)", s.transmitted || 0, fmtChf(s.transmitted_amount)],
      ["Stornoed", s.stornoed || 0, fmtChf(s.stornoed_amount)],
      ["Duplicates", s.duplicates || 0, fmtChf(s.duplicates_amount)],
      ["Wrong Routing", s.wrong_routing || 0, fmtChf(s.wrong_routing_amount)],
      ["  Wrong Routing — Still Unpaid", s.wrong_routing_unpaid || 0, fmtChf(s.wrong_routing_unpaid_amount)],
      ["  Wrong Routing — Paid Despite", s.wrong_routing_paid || 0, ""],
      ["", ""],
      ["Action Needed", "Count", "Amount (CHF)"],
      ["RESEND — Stornoed, never resent", s.action_resend_stornoed || 0, fmtChf(s.action_resend_stornoed_amount)],
      ["RESEND — Wrong routing, still unpaid", s.action_resend_wrong_routing || 0, fmtChf(s.action_resend_wrong_routing_amount)],
      ["FOLLOW UP — Transmitted, insurer unresponsive", s.action_follow_up_transmitted || 0, fmtChf(s.action_follow_up_transmitted_amount)],
      ["FOLLOW UP — Rejected, not yet paid", s.action_follow_up_rejected || 0, fmtChf(s.action_follow_up_rejected_amount)],
      ["ARCHIVE — Duplicates (paid replacement exists)", s.action_archive_duplicates || 0, fmtChf(s.action_archive_duplicates_amount)],
      ["SEND — Not yet sent to MediData", s.action_send_not_sent || 0, fmtChf(s.action_send_not_sent_amount)],
      ["", "", ""],
      ["Recommendation Summary", "Count", "Amount (CHF)"],
      ...Object.entries(data.recommendationSummary || {})
        .sort((a: any, b: any) => b[1].amount - a[1].amount)
        .map(([cat, val]: [string, any]) => [cat, val.count, fmtChf(val.amount)]),
      ["", "", ""],
      ["Stornoed Breakdown", "Count", "Amount (CHF)"],
      ["Not Resent", s.stornoed_not_resent || 0, fmtChf(s.stornoed_not_resent_amount)],
      ["Resent & Paid", s.stornoed_resent_paid || 0, ""],
      ["Resent, Not Paid", s.stornoed_resent_not_paid || 0, ""],
      ["A10/A20 Related", s.stornoed_a10_a20 || 0, ""],
      ["", ""],
      ["Aging — Transmitted (Unpaid)", "Count", "Amount (CHF)"],
      ["0-7 days", ab["0-7"] || 0, fmtChf(aa["0-7"] || 0)],
      ["8-30 days", ab["8-30"] || 0, fmtChf(aa["8-30"] || 0)],
      ["31-60 days", ab["31-60"] || 0, fmtChf(aa["31-60"] || 0)],
      ["61-90 days", ab["61-90"] || 0, fmtChf(aa["61-90"] || 0)],
      ["90+ days", ab["90+"] || 0, fmtChf(aa["90+"] || 0)],
    ];

    // ── Sheet 2: All Invoices ──
    const invHeaders = [
      "Patient Name", "Invoice Number", "Invoice Date", "Amount (CHF)",
      "Billing Type", "Insurance", "Insurance GLN", "Invoice Status",
      "Sent to MediData", "Submission Status", "Final Category",
      "Total Paid (CHF)", "Fully Paid?", "Has Storno?", "Storno Reason",
      "Storno Status", "A10/A20?", "Was Resent?", "Replacement Paid?",
      "Replacement Invoices", "Is Duplicate?", "Duplicate Detail",
      "Routing Correct?", "Routed To GLN", "Routed To Name",
      "Age (days)", "Rejection Reason", "Bank Paid (CHF)", "Bank Detail",
      "Action Category", "Recommendation",
    ];

    const invRows = rows.map((r) => [
      r.patient_name, r.invoice_number, r.invoice_date, fmtChf(r.amount),
      r.billing_type, r.insurance_name, r.insurance_gln, r.invoice_status,
      r.sent_to_medidata ? "YES" : "NO", r.submission_status, r.final_category,
      fmtChf(r.total_paid), r.fully_paid ? "YES" : "NO",
      r.has_storno ? "YES" : "NO", r.storno_reason, r.storno_status,
      r.is_a10_a20 ? "YES" : "NO", r.was_resent ? "YES" : "NO",
      r.replacement_paid ? "YES" : "NO", r.replacement_invoices,
      r.is_duplicate ? "YES" : "NO", r.duplicate_detail,
      r.routing_correct, r.routed_to_gln, r.routed_to_name,
      r.age_days, r.rejection_reason, fmtChf(r.bank_paid), r.bank_detail,
      r.action_category, r.recommendation,
    ]);

    const invTotals = [
      "", "", "TOTAL", fmtChf(rows.reduce((sum, r) => sum + (r.amount || 0), 0)),
      "", "", "", "", "", "", "",
      fmtChf(rows.reduce((sum, r) => sum + (r.total_paid || 0), 0)),
      "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
    ];

    // ── Sheet 3: Stornoed Invoices ──
    const stornoRows = rows.filter((r) => r.has_storno);
    const stornoHeaders = [
      "Patient Name", "Invoice Number", "Invoice Date", "Amount (CHF)",
      "Insurance", "Invoice Status", "Storno Status", "Storno Reason",
      "A10/A20?", "Was Resent?", "Replacement Invoices", "Replacement Paid?",
      "Total Paid (CHF)", "Age (days)", "Action Category", "Recommendation",
    ];
    const stornoData = stornoRows.map((r) => [
      r.patient_name, r.invoice_number, r.invoice_date, fmtChf(r.amount),
      r.insurance_name, r.invoice_status, r.storno_status, r.storno_reason,
      r.is_a10_a20 ? "YES" : "NO", r.was_resent ? "YES" : "NO",
      r.replacement_invoices, r.replacement_paid ? "YES" : "NO",
      fmtChf(r.total_paid), r.age_days, r.action_category, r.recommendation,
    ]);
    const stornoTotals = [
      "", "", "TOTAL", fmtChf(stornoRows.reduce((s, r) => s + (r.amount || 0), 0)),
      "", "", "", "", "", "", "", "", fmtChf(stornoRows.reduce((s, r) => s + (r.total_paid || 0), 0)), "", "", "",
    ];

    // ── Sheet 4: Duplicates ──
    const dupRows = rows.filter((r) => r.is_duplicate);
    const dupHeaders = [
      "Patient Name", "Invoice Number", "Invoice Date", "Amount (CHF)",
      "Insurance", "Duplicate Detail", "Total Paid (CHF)",
    ];
    const dupData = dupRows.map((r) => [
      r.patient_name, r.invoice_number, r.invoice_date, fmtChf(r.amount),
      r.insurance_name, r.duplicate_detail, fmtChf(r.total_paid),
    ]);
    const dupTotals = [
      "", "", "TOTAL", fmtChf(dupRows.reduce((s, r) => s + (r.amount || 0), 0)),
      "", "", fmtChf(dupRows.reduce((s, r) => s + (r.total_paid || 0), 0)),
    ];

    const buf = buildStatisticsWorkbook({
      filename: makeFilename("medidata_status", from, to),
      reportTitle: "MediData Insurance Status Report",
      filters: {
        "From": from,
        "To": to,
        "Min Age (days)": agingMinDays > 0 ? String(agingMinDays) : "All",
      },
      sheets: [
        {
          name: "Summary",
          headers: ["Metric", "Count", "Amount (CHF)"],
          rows: summaryRows,
          columnWidths: [35, 10, 15],
        },
        {
          name: "All Invoices",
          headers: invHeaders,
          rows: invRows,
          totals: invTotals,
          columnWidths: [
            28, 14, 12, 12, 10, 30, 18, 14, 10, 20, 20,
            14, 10, 10, 50, 20, 10, 10, 10, 30, 10, 50,
            12, 18, 30, 10, 50, 14, 50, 20, 80,
          ],
        },
        {
          name: "Stornoed",
          headers: stornoHeaders,
          rows: stornoData,
          totals: stornoTotals,
          columnWidths: [28, 14, 12, 12, 30, 14, 20, 50, 10, 10, 30, 10, 14, 10, 20, 80],
        },
        {
          name: "Duplicates",
          headers: dupHeaders,
          rows: dupData,
          totals: dupTotals,
          columnWidths: [28, 14, 12, 12, 30, 50, 14],
        },
      ],
    });

    const filename = makeFilename("medidata_status", from, to) + ".xlsx";
    return new NextResponse(new Uint8Array(buf) as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
