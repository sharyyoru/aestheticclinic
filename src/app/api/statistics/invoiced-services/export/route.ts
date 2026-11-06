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
    dateField: "invoice_date",
    paidStatusOnly: false,
    reportTitle: "Prestations facturées (Invoiced Services)",
    filename: "Prestations_facturees",
  });
}
