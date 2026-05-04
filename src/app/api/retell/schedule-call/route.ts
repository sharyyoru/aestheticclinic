/**
 * POST /api/retell/schedule-call
 *
 * Schedules an outbound Retell AI call to be fired exactly 1 hour from now.
 * Called internally by the deal-stage-changed workflow when a deal enters
 * a stage whose name contains "request for information".
 *
 * Body: { patient_id, deal_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhone, RETELL_FROM_NUMBER } from "@/lib/retell";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      patient_id?: string;
      deal_id?: string;
    };

    const patientId = body.patient_id?.trim();
    const dealId = body.deal_id?.trim();

    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    // Fetch patient phone + name
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, phone")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (!patient.phone) {
      return NextResponse.json(
        { error: "Patient has no phone number – cannot schedule call" },
        { status: 422 },
      );
    }

    // Fetch deal service name
    let serviceName = "our services";
    if (dealId) {
      const { data: deal } = await supabaseAdmin
        .from("deals")
        .select("service_id, title, services(name)")
        .eq("id", dealId)
        .maybeSingle();

      if (deal) {
        // services is a joined object (Supabase nested select)
        const svc = (deal as any).services;
        if (svc?.name) {
          serviceName = svc.name as string;
        } else if (deal.title) {
          // Fallback: extract service from deal title "Patient Name - Service"
          const parts = (deal.title as string).split(" - ");
          if (parts.length > 1) {
            serviceName = parts.slice(1).join(" - ").trim();
          }
        }
      }
    }

    const userName = [patient.first_name, patient.last_name]
      .filter(Boolean)
      .join(" ") || "there";

    const toNumber = normalizePhone(patient.phone as string);

    if (!RETELL_FROM_NUMBER) {
      return NextResponse.json(
        { error: "RETELL_FROM_NUMBER env var not configured" },
        { status: 500 },
      );
    }

    // Schedule 1 hour from now
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: scheduled, error: insertError } = await supabaseAdmin
      .from("retell_scheduled_calls")
      .insert({
        patient_id: patientId,
        deal_id: dealId ?? null,
        scheduled_for: scheduledFor,
        status: "pending",
        user_name: patient.first_name ?? userName,  // first name only for the agent greeting
        service_name: serviceName,
        to_number: toNumber,
      })
      .select("id")
      .single();

    if (insertError || !scheduled) {
      console.error("Failed to insert retell_scheduled_calls:", insertError);
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to schedule call" },
        { status: 500 },
      );
    }

    console.log(
      `Retell call scheduled for ${scheduledFor} → patient ${patientId} (${toNumber})`,
    );

    return NextResponse.json({
      ok: true,
      scheduled_call_id: (scheduled as any).id,
      scheduled_for: scheduledFor,
    });
  } catch (err: any) {
    console.error("Error in /api/retell/schedule-call:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
