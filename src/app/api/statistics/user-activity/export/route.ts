import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeUserActivity, ACTIVITY_TYPE_LABELS } from "@/lib/userActivity";
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
    const userId = url.searchParams.get("userId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!userId || !from || !to) {
      return NextResponse.json(
        { error: "Missing required params: userId, from, to" },
        { status: 400 },
      );
    }

    const [{ data: profile }, activity] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle(),
      computeUserActivity(userId, from, to),
    ]);

    const userLabel = profile?.full_name || profile?.email || userId;

    const summaryHeaders = ["Metric", "Count"];
    const summaryRows: ExcelCell[][] = [
      ["Distinct deals touched", activity.totals.distinctDeals],
      ["Distinct patients touched", activity.totals.distinctPatients],
      ["Stage changes", activity.totals.byType.stage_change],
      ["Appointments scheduled/updated", activity.totals.byType.appointment],
      ["Notes written", activity.totals.byType.note],
      ["Tasks created/assigned", activity.totals.byType.task],
      ["Emails sent", activity.totals.byType.email],
    ];

    const detailHeaders = ["Date", "Type", "Patient", "Deal", "Description"];
    const detailRows: ExcelCell[][] = activity.rows.map((r) => [
      fmtDate(r.timestamp),
      ACTIVITY_TYPE_LABELS[r.type],
      r.patientName || "—",
      r.dealTitle || "—",
      r.description,
    ]);

    const filename = makeFilename(`User_Activity_${userLabel}`, from, to);
    const buf = buildStatisticsWorkbook({
      filename,
      reportTitle: `Activity Report — ${userLabel}`,
      filters: {
        Utilisateur: userLabel,
        Période: `${from} → ${to}`,
      },
      sheets: [
        {
          name: "Summary",
          headers: summaryHeaders,
          rows: summaryRows,
          columnWidths: [32, 14],
        },
        {
          name: "Activity Detail",
          headers: detailHeaders,
          rows: detailRows,
          columnWidths: [14, 16, 24, 30, 60],
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
