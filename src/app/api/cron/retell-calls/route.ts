/**
 * GET /api/cron/retell-calls
 *
 * Cron dispatcher — fires every minute (configure in vercel.json or external cron).
 * Picks up all `retell_scheduled_calls` with status = 'pending' and scheduled_for <= now(),
 * calls the Retell API, and updates the record status.
 *
 * Secured by CRON_SECRET header to prevent public access.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createRetellCall,
  RETELL_AGENT_ID,
  RETELL_FROM_NUMBER,
} from "@/lib/retell";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!RETELL_AGENT_ID || !RETELL_FROM_NUMBER) {
    return NextResponse.json(
      { error: "RETELL_AGENT_ID or RETELL_FROM_NUMBER not configured" },
      { status: 500 },
    );
  }

  // Fetch pending calls that are due
  const now = new Date().toISOString();
  const { data: dueCalls, error: fetchError } = await supabaseAdmin
    .from("retell_scheduled_calls")
    .select("id, patient_id, deal_id, to_number, user_name, service_name")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(20); // process max 20 per invocation

  if (fetchError) {
    console.error("retell-calls cron: failed to fetch due calls:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!dueCalls || dueCalls.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  let dispatched = 0;
  let failed = 0;

  for (const call of dueCalls) {
    try {
      // Mark as dispatched immediately to prevent double-fire
      await supabaseAdmin
        .from("retell_scheduled_calls")
        .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
        .eq("id", call.id);

      // Fire the Retell call
      const retellResponse = await createRetellCall({
        from_number: RETELL_FROM_NUMBER,
        to_number: call.to_number as string,
        agent_id: RETELL_AGENT_ID,
        retell_llm_dynamic_variables: {
          user_name: call.user_name as string,
          service_name: call.service_name as string,
        },
        metadata: {
          patient_id: call.patient_id as string,
          deal_id: (call.deal_id as string) ?? "",
          scheduled_call_id: call.id as string,
        },
      });

      // Persist the Retell call_id back to the scheduled call row
      await supabaseAdmin
        .from("retell_scheduled_calls")
        .update({ retell_call_id: retellResponse.call_id })
        .eq("id", call.id);

      // Create an initial call log entry (outcome filled in by webhook)
      await supabaseAdmin.from("retell_call_logs").insert({
        retell_call_id: retellResponse.call_id,
        patient_id: call.patient_id,
        deal_id: call.deal_id ?? null,
        scheduled_call_id: call.id,
        event_type: "call_initiated",
        call_status: retellResponse.call_status ?? "initiated",
      });

      console.log(
        `Retell call dispatched: ${retellResponse.call_id} → patient ${call.patient_id}`,
      );
      dispatched += 1;
    } catch (err: any) {
      console.error(`Failed to dispatch Retell call for scheduled_call ${call.id}:`, err);

      // Mark as failed so we don't retry endlessly
      await supabaseAdmin
        .from("retell_scheduled_calls")
        .update({ status: "failed", error_message: err.message ?? "Unknown error" })
        .eq("id", call.id);

      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, dispatched, failed });
}
