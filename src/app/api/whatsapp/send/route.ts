import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFromEnv = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886" or "+14155238886"

if (!accountSid || !authToken || !whatsappFromEnv) {
  throw new Error(
    "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM environment variables",
  );
}

const whatsappFrom = whatsappFromEnv as string;

function normalizeWhatsAppAddress(value: string): string {
  let v = value.trim();

  // Remove leading whatsapp: prefix if present
  if (v.toLowerCase().startsWith("whatsapp:")) {
    v = v.slice("whatsapp:".length);
  }

  // Strip spaces and common formatting, keep only digits and an optional leading +
  const cleaned = v.replace(/[^\d+]/g, "");
  if (!cleaned) return "";

  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;

  return `whatsapp:${withPlus}`;
}

export async function POST(request: Request) {
  try {
    const {
      patientId,
      to,
      toNumber,
      body,
      message,
      // New template fields (preferred)
      contentSid,
      contentVariables,
      templateId,
      // Legacy template fields (still supported)
      templateSid,
      templateVariables,
      // Scheduled send: store as queued, cron will deliver
      scheduledAt,
      // Internal flag: skip window check (used by cron for pre-validated messages)
      _skipWindowCheck,
    } = (await request.json()) as {
      patientId?: string | null;
      to?: string;
      toNumber?: string;
      body?: string;
      message?: string;
      contentSid?: string | null;
      contentVariables?: Record<string, string> | null;
      templateId?: string | null;
      templateSid?: string | null;
      templateVariables?: Record<string, string> | null;
      scheduledAt?: string | null;
      _skipWindowCheck?: boolean;
    };

    const toRaw = (toNumber || to || "").trim();
    const messageBody = (message || body || "").trim();

    // Normalise template fields — support both old (templateSid) and new (contentSid) naming
    const resolvedContentSid = (contentSid ?? templateSid ?? "").trim() || null;
    const resolvedContentVars =
      (contentVariables ?? templateVariables) &&
      typeof (contentVariables ?? templateVariables) === "object"
        ? (contentVariables ?? templateVariables)
        : null;

    if (!toRaw) {
      return NextResponse.json(
        { error: "Missing required field: to" },
        { status: 400 },
      );
    }

    if (!resolvedContentSid && !messageBody) {
      return NextResponse.json(
        { error: "Missing message body for non-template WhatsApp send" },
        { status: 400 },
      );
    }

    // Check if patient has opted out of WhatsApp notifications
    if (patientId) {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("whatsapp_opt_in")
        .eq("id", patientId)
        .single();

      if (patient && patient.whatsapp_opt_in === false) {
        return NextResponse.json(
          { ok: false, skipped: true, reason: "Patient has not opted in to WhatsApp notifications" },
          { status: 200 },
        );
      }
    }

    // --- 24h window check ---
    // Free-form messages (no template) are only allowed inside the 24h window.
    // Templates (ContentSid) are always allowed.
    if (!resolvedContentSid && !_skipWindowCheck) {
      let windowOpen = false;

      if (patientId) {
        const { data: conv } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("window_expires_at")
          .eq("patient_id", patientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conv?.window_expires_at) {
          windowOpen = new Date(conv.window_expires_at) > new Date();
        }
      } else {
        // No patientId — check by phone number
        const normalizedPhone = toRaw.replace(/^whatsapp:/i, "").trim();
        const { data: conv } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("window_expires_at")
          .eq("phone_number", normalizedPhone)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conv?.window_expires_at) {
          windowOpen = new Date(conv.window_expires_at) > new Date();
        }
      }

      if (!windowOpen) {
        return NextResponse.json(
          {
            error:
              "24h messaging window is closed. Use an approved template (contentSid) to message this patient.",
            windowClosed: true,
          },
          { status: 400 },
        );
      }
    }

    // --- Scheduled send: store as queued, skip Twilio call ---
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate > new Date()) {
        const displayBody =
          messageBody || (resolvedContentSid ? `[Template: ${resolvedContentSid}]` : "");

        const { data, error } = await supabaseAdmin
          .from("whatsapp_messages")
          .insert({
            patient_id: patientId ?? null,
            to_number: toRaw,
            from_number: whatsappFrom,
            body: displayBody,
            status: "queued",
            direction: "outbound",
            sent_at: new Date().toISOString(),
            scheduled_at: scheduledDate.toISOString(),
            template_id: templateId ?? null,
            metadata: resolvedContentSid
              ? {
                  content_sid: resolvedContentSid,
                  content_variables: resolvedContentVars,
                }
              : null,
          })
          .select("id")
          .single();

        if (error || !data) {
          console.error("Failed to queue scheduled WhatsApp message", error);
          return NextResponse.json({ error: "Failed to queue message" }, { status: 500 });
        }

        return NextResponse.json({ ok: true, queued: true, id: (data as any).id as string });
      }
    }

    // --- Send immediately via Twilio ---
    const fromAddress = normalizeWhatsAppAddress(whatsappFrom);
    const toAddress = normalizeWhatsAppAddress(toRaw);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    const params = new URLSearchParams();
    params.append("From", fromAddress);
    params.append("To", toAddress);
    if (appUrl) {
      params.append("StatusCallback", `${appUrl}/api/whatsapp/status-callback`);
    }
    if (resolvedContentSid) {
      params.append("ContentSid", resolvedContentSid);
      if (resolvedContentVars && Object.keys(resolvedContentVars).length > 0) {
        params.append("ContentVariables", JSON.stringify(resolvedContentVars));
      }
    } else {
      params.append("Body", messageBody);
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );

    const twilioBody = (await twilioResponse.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!twilioResponse.ok) {
      console.error(
        "Error sending WhatsApp message via Twilio",
        twilioResponse.status,
        twilioBody,
      );
      return NextResponse.json(
        {
          error: "Failed to send WhatsApp message via Twilio",
          twilioStatus: twilioResponse.status,
          twilioBody,
        },
        { status: 502 },
      );
    }

    const sid = (twilioBody?.sid as string | undefined) ?? null;
    const dateCreatedRaw = twilioBody?.date_created as string | undefined;

    let sentAtIso: string | null = null;
    if (dateCreatedRaw) {
      const parsed = new Date(dateCreatedRaw);
      if (!Number.isNaN(parsed.getTime())) {
        sentAtIso = parsed.toISOString();
      }
    }
    if (!sentAtIso) {
      sentAtIso = new Date().toISOString();
    }

    const displayBody =
      messageBody || (resolvedContentSid ? `[Template: ${resolvedContentSid}]` : "");

    const { data, error } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        patient_id: patientId ?? null,
        to_number: toRaw,
        from_number: whatsappFrom,
        body: displayBody,
        status: "sent",
        direction: "outbound",
        message_sid: sid,
        sent_at: sentAtIso,
        template_id: templateId ?? null,
        metadata: resolvedContentSid
          ? {
              content_sid: resolvedContentSid,
              content_variables: resolvedContentVars,
            }
          : null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Failed to insert whatsapp_messages row", error);
      return NextResponse.json(
        { error: "Failed to store WhatsApp message" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, id: (data as any).id as string });
  } catch (error) {
    console.error("Unexpected error in /api/whatsapp/send", error);
    return NextResponse.json(
      { error: "Unexpected error sending WhatsApp message" },
      { status: 500 },
    );
  }
}
