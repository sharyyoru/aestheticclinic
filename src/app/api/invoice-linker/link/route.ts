import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoice-linker/link
 * Body: { invoice_id, consultation_id, force?: boolean }
 *
 * Behavior:
 *   - If the consultation already has another invoice linked AND force is false,
 *     returns 409 Conflict with the existing link info (UI should confirm).
 *   - If force is true, first nulls out the consultation_id on the previously
 *     linked invoice, then sets it on the new invoice.
 *   - Transactional-ish: we do the unlink + link sequentially; if link fails,
 *     we restore the original link.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body.invoice_id || "").trim();
    const consultationId = String(body.consultation_id || "").trim();
    const force = !!body.force;

    if (!invoiceId || !consultationId) {
      return NextResponse.json(
        { error: "invoice_id and consultation_id are required" },
        { status: 400 },
      );
    }

    // Validate the invoice exists and currently has no consultation_id
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, consultation_id, patient_id")
      .eq("id", invoiceId)
      .single();
    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Validate the consultation exists
    const { data: consultation, error: cErr } = await supabaseAdmin
      .from("consultations")
      .select("id, patient_id")
      .eq("id", consultationId)
      .single();
    if (cErr || !consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    // Check patient mismatch
    if (
      invoice.patient_id &&
      consultation.patient_id &&
      invoice.patient_id !== consultation.patient_id
    ) {
      return NextResponse.json(
        {
          error: "Patient mismatch between invoice and consultation",
          code: "PATIENT_MISMATCH",
        },
        { status: 400 },
      );
    }

    // Check if another invoice is already linked to this consultation
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number")
      .eq("consultation_id", consultationId)
      .neq("id", invoiceId)
      .limit(1);
    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }

    const conflict = existing && existing.length > 0 ? existing[0] : null;

    if (conflict && !force) {
      return NextResponse.json(
        {
          error: "Consultation already linked to another invoice",
          code: "ALREADY_LINKED",
          existing_invoice_id: conflict.id,
          existing_invoice_number: conflict.invoice_number,
        },
        { status: 409 },
      );
    }

    // If conflict and force=true, first unlink the existing invoice
    if (conflict && force) {
      const { error: unlinkErr } = await supabaseAdmin
        .from("invoices")
        .update({ consultation_id: null, updated_at: new Date().toISOString() })
        .eq("id", conflict.id);
      if (unlinkErr) {
        return NextResponse.json({ error: unlinkErr.message }, { status: 500 });
      }
    }

    // Now link the new invoice. If this fails and we had an unlink, restore it.
    const { error: linkErr } = await supabaseAdmin
      .from("invoices")
      .update({
        consultation_id: consultationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (linkErr) {
      if (conflict && force) {
        // restore previous link
        await supabaseAdmin
          .from("invoices")
          .update({ consultation_id: consultationId })
          .eq("id", conflict.id);
      }
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      invoice_id: invoiceId,
      consultation_id: consultationId,
      unlinked_invoice: conflict ? conflict.id : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
