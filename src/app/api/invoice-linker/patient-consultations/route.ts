import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoice-linker/patient-consultations?patientId=...
 *
 * Returns the patient's non-archived consultations with a flag indicating
 * whether each one is already linked to a different invoice (enforcing
 * the 1:1 invoice<->consultation constraint at the UI level).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId") || "";
    if (!patientId) {
      return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    // 1. All non-archived, non-invoice-record consultations for this patient
    const { data: consults, error: consErr } = await supabaseAdmin
      .from("consultations")
      .select(
        "id, title, content, scheduled_at, doctor_name, record_type, duration_seconds, diagnosis_code, ref_icd10, created_by_name, created_at, invoice_total_amount",
      )
      .eq("patient_id", patientId)
      .eq("is_demo", false)
      .eq("is_archived", false)
      .neq("record_type", "invoice")
      .order("scheduled_at", { ascending: false })
      .limit(500);

    if (consErr) {
      return NextResponse.json({ error: consErr.message }, { status: 500 });
    }

    const consultationIds = (consults ?? []).map((c: any) => c.id);

    // 2. For each consultation, find any invoice currently linked to it
    let existingLinksMap = new Map<
      string,
      { invoice_id: string; invoice_number: string | null; total_amount: number | null }
    >();

    if (consultationIds.length > 0) {
      const { data: linked, error: linkErr } = await supabaseAdmin
        .from("invoices")
        .select("id, invoice_number, total_amount, consultation_id")
        .in("consultation_id", consultationIds)
        .eq("is_demo", false)
        .eq("is_archived", false);
      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 });
      }
      for (const row of linked ?? []) {
        if (row.consultation_id) {
          existingLinksMap.set(row.consultation_id, {
            invoice_id: row.id,
            invoice_number: row.invoice_number,
            total_amount: row.total_amount,
          });
        }
      }
    }

    const rows = (consults ?? []).map((c: any) => {
      const existing = existingLinksMap.get(c.id);
      return {
        consultation_id: c.id,
        title: c.title,
        content: c.content,
        scheduled_at: c.scheduled_at,
        doctor_name: c.doctor_name,
        record_type: c.record_type,
        duration_seconds: c.duration_seconds,
        diagnosis_code: c.diagnosis_code,
        ref_icd10: c.ref_icd10,
        created_by_name: c.created_by_name,
        invoice_total_amount: c.invoice_total_amount,
        linked_invoice_id: existing?.invoice_id ?? null,
        linked_invoice_number: existing?.invoice_number ?? null,
        linked_invoice_total: existing?.total_amount ?? null,
      };
    });

    return NextResponse.json({ rows, total: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
