import { NextRequest } from "next/server";
import { exportServices } from "../../invoiced-services/export/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return exportServices(req, {
    dateField: "paid_at",
    paidStatusOnly: true,
    reportTitle: "Prestations payées (Paid Services)",
    filename: "Prestations_payees",
  });
}
