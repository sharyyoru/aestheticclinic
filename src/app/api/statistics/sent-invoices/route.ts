import { NextRequest, NextResponse } from "next/server";
import {
  fetchSentInvoices,
  buildSentInvoicesResponse,
} from "@/lib/statisticsFetchers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json(
        { error: "Missing 'from' or 'to' query parameter" },
        { status: 400 },
      );
    }
    const rows = await fetchSentInvoices({
      from,
      to,
      entityId: url.searchParams.get("entityId") || "",
      doctorId: url.searchParams.get("doctorId") || "",
      law: url.searchParams.get("law") || "",
      billingType: url.searchParams.get("billingType") || "",
      includeCancelled:
        url.searchParams.get("includeCancelled") === "true",
    });
    return NextResponse.json(buildSentInvoicesResponse(rows));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
