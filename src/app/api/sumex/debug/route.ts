import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    SUMEX_INVOICE_REQUEST_URL: process.env.SUMEX_INVOICE_REQUEST_URL,
    SUMEX_INVOICE_RESPONSE_URL: process.env.SUMEX_INVOICE_RESPONSE_URL,
    SUMEX_ACF_URL: process.env.SUMEX_ACF_URL,
    SUMEX_ACF_BASE_URL: process.env.SUMEX_ACF_BASE_URL,
    SUMEX_TARDOC_URL: process.env.SUMEX_TARDOC_URL,
  });
}

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

  const { data: invoice } = await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: lineItems } = await supabaseAdmin.from("invoice_line_items").select("*").eq("invoice_id", invoiceId).order("sort_order", { ascending: true });
  const { data: patient } = await supabaseAdmin.from("patients").select("*").eq("id", invoice.patient_id).single();
  const { data: provider } = await supabaseAdmin.from("providers").select("*").eq("id", invoice.provider_id).single();

  return NextResponse.json({
    invoice: {
      billing_type: invoice.billing_type,
      insurer_id: invoice.insurer_id,
      insurance_gln: invoice.insurance_gln,
      insurance_name: invoice.insurance_name,
      patient_ssn: invoice.patient_ssn,
      provider_gln: invoice.provider_gln,
      provider_zsr: invoice.provider_zsr,
      provider_iban: invoice.provider_iban,
      doctor_gln: invoice.doctor_gln,
      doctor_zsr: invoice.doctor_zsr,
      health_insurance_law: invoice.health_insurance_law,
      treatment_canton: invoice.treatment_canton,
    },
    provider: {
      gln: provider?.gln,
      zsr: provider?.zsr,
      iban: provider?.iban,
      role: provider?.role,
      qual_dignities: provider?.qual_dignities,
    },
    patient: {
      ssn: patient?.ssn,
      ahvn13: (patient as any)?.ahvn13,
      avs_number: (patient as any)?.avs_number,
      dob: patient?.dob,
      gender: patient?.gender,
    },
    lineItems: lineItems?.map((li: any) => ({
      code: li.code,
      tariff_code: li.tariff_code,
      tp_al: li.tp_al,
      tp_tl: li.tp_tl,
      tp_al_value: li.tp_al_value,
      tp_tl_value: li.tp_tl_value,
      unit_price: li.unit_price,
      quantity: li.quantity,
      provider_gln: li.provider_gln,
      responsible_gln: li.responsible_gln,
    })),
  });
}
