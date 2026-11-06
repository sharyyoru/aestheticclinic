import { NextRequest, NextResponse } from "next/server";
import {
  fetchServiceLines,
  buildServicesResponse,
} from "@/lib/statisticsFetchers";
import { requireStaff, requireRole, authErrorResponse } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
      await requireStaff(req);
    } catch (err) {
      return authErrorResponse(err);
    }
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }
    const rows = await fetchServiceLines({
      from,
      to,
      entityId: url.searchParams.get("entityId") || "",
      doctorId: url.searchParams.get("doctorId") || "",
      law: url.searchParams.get("law") || "",
      billingType: url.searchParams.get("billingType") || "",
      dateField: "paid_at",
      paidStatusOnly: true,
    });
    return NextResponse.json(buildServicesResponse(rows));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
