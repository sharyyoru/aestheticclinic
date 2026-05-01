import { NextRequest } from "next/server";
import { exportServices } from "@/lib/statisticsServicesExport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return exportServices(req, {
    dateField: "invoice_date",
    paidStatusOnly: false,
    reportTitle: "Prestations facturées (Invoiced Services)",
    filename: "Prestations_facturees",
  });
}
