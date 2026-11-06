import { NextRequest } from "next/server";
import { exportServices } from "@/lib/statisticsServicesExport";
import { requireStaff, requireRole, authErrorResponse } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
      await requireStaff(req);
    } catch (err) {
      return authErrorResponse(err);
    }
  return exportServices(req, {
    dateField: "paid_at",
    paidStatusOnly: true,
    reportTitle: "Prestations payées (Paid Services)",
    filename: "Prestations_payees",
  });
}
