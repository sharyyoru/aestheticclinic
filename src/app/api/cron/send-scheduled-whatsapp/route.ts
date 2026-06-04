import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 50;

// POST /api/cron/send-scheduled-whatsapp
// Runs hourly (see vercel.json).
// Picks up whatsapp_messages rows with status='queued' and scheduled_at <= now(),
// fires each through /api/whatsapp/send, and marks them sent or failed.
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("Authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL not configured" }, { status: 500 });
  }

  // Fetch due messages
  const { data: pending, error: fetchError } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, patient_id, to_number, body, template_id, metadata")
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("[cron/send-scheduled-whatsapp] Failed to fetch pending messages:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const messages = pending ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  console.log(`[cron/send-scheduled-whatsapp] Processing ${messages.length} scheduled messages`);

  let sent = 0;
  let failed = 0;

  for (const msg of messages) {
    const meta = (msg.metadata ?? {}) as Record<string, unknown>;
    const contentSid  = (meta.content_sid as string | undefined) ?? null;
    const contentVars = (meta.content_variables as Record<string, string> | undefined) ?? null;

    const payload: Record<string, unknown> = {
      patientId: msg.patient_id,
      to:        msg.to_number,
      _skipWindowCheck: true, // window was checked at enqueue time
    };

    if (contentSid) {
      payload.contentSid        = contentSid;
      payload.contentVariables  = contentVars;
      payload.templateId        = msg.template_id ?? null;
    } else {
      payload.body = msg.body;
    }

    try {
      const res = await fetch(`${appUrl}/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (res.ok || (result as any).skipped) {
        // Message sent (or patient opted-out — either way, not a cron failure)
        console.log(`[cron/send-scheduled-whatsapp] Sent message ${msg.id}`);
        // The send route already updates status to 'sent'; nothing more to do.
        sent++;
      } else {
        console.error(`[cron/send-scheduled-whatsapp] Failed message ${msg.id}:`, result);
        // Mark as failed so the cron doesn't retry endlessly
        await supabaseAdmin
          .from("whatsapp_messages")
          .update({ status: "failed", error_message: (result as any).error ?? "Cron send failed" })
          .eq("id", msg.id);
        failed++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/send-scheduled-whatsapp] Unexpected error for message ${msg.id}:`, message);
      await supabaseAdmin
        .from("whatsapp_messages")
        .update({ status: "failed", error_message: message })
        .eq("id", msg.id);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed: messages.length, sent, failed });
}
