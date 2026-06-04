import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Backfill WhatsApp step for workflow enrollments that missed it.
 * POST /api/workflows/backfill-whatsapp
 * Body: { workflowId: string, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { workflowId, dryRun = true } = await request.json();

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId required" }, { status: 400 });
    }

    // Get workflow config to find WhatsApp template SID
    const { data: workflow, error: wfError } = await supabaseAdmin
      .from("workflows")
      .select("id, name, config")
      .eq("id", workflowId)
      .single();

    if (wfError || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Find WhatsApp action in workflow config
    const config = workflow.config as any;
    const nodes = config?.nodes || [];
    const whatsappAction = nodes.find((n: any) => n.data?.actionType === "send_whatsapp");

    if (!whatsappAction) {
      return NextResponse.json({ error: "No WhatsApp action found in workflow" }, { status: 400 });
    }

    const templateSid = whatsappAction.data?.config?.template_sid || "HXdff188b222fe82c18233b2422dd04792";
    console.log("[Backfill] WhatsApp template SID:", templateSid);

    // Get all active enrollments for this workflow
    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from("workflow_enrollments")
      .select(`
        id,
        patient_id,
        status,
        created_at,
        patients (
          id,
          first_name,
          last_name,
          phone,
          whatsapp_opt_in
        ),
        workflow_enrollment_steps (
          id,
          step_action
        )
      `)
      .eq("workflow_id", workflowId)
      .eq("status", "active");

    if (enrollError) {
      console.error("[Backfill] Error fetching enrollments:", enrollError);
      return NextResponse.json({ error: "Failed to fetch enrollments" }, { status: 500 });
    }

    // Filter to those missing WhatsApp step
    const missingWhatsApp = enrollments.filter((e: any) => {
      const steps = e.workflow_enrollment_steps || [];
      return !steps.some((s: any) => s.step_action === "send_whatsapp");
    });

    console.log(`[Backfill] Found ${missingWhatsApp.length} enrollments missing WhatsApp step`);

    const results: any[] = [];
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const enrollment of missingWhatsApp) {
      const patient = (enrollment as any).patients;
      const patientName = `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim();
      const patientPhone = patient?.phone;

      // Skip if no phone
      if (!patientPhone) {
        results.push({
          enrollmentId: enrollment.id,
          patientName,
          status: "skipped",
          reason: "No phone number",
        });
        skipped++;
        continue;
      }

      // Skip if opted out
      if (patient?.whatsapp_opt_in === false) {
        results.push({
          enrollmentId: enrollment.id,
          patientName,
          status: "skipped",
          reason: "WhatsApp opt-out",
        });
        skipped++;
        continue;
      }

      if (dryRun) {
        results.push({
          enrollmentId: enrollment.id,
          patientId: patient.id,
          patientName,
          phone: patientPhone,
          status: "would_send",
          templateSid,
        });
        sent++;
        continue;
      }

      // Actually send the WhatsApp message
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const res = await fetch(`${appUrl}/api/whatsapp/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: patientPhone,
            patientId: patient.id,
            contentSid: templateSid,
            contentVariables: { "1": patient.first_name || "there" },
            _skipWindowCheck: true,
          }),
        });

        const result = await res.json();

        if (res.ok) {
          // Log the step
          await supabaseAdmin.from("workflow_enrollment_steps").insert({
            enrollment_id: enrollment.id,
            step_type: "action",
            step_action: "send_whatsapp",
            status: "completed",
            result: { backfilled: true, messageSid: result.sid },
          });

          results.push({
            enrollmentId: enrollment.id,
            patientName,
            status: "sent",
            messageSid: result.sid,
          });
          sent++;
        } else {
          results.push({
            enrollmentId: enrollment.id,
            patientName,
            status: "error",
            error: result.error || "Send failed",
          });
          errors++;
        }
      } catch (err: any) {
        results.push({
          enrollmentId: enrollment.id,
          patientName,
          status: "error",
          error: err.message,
        });
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      templateSid,
      totalEnrollments: enrollments.length,
      missingWhatsApp: missingWhatsApp.length,
      sent,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    console.error("[Backfill] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
