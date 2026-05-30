import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const smsFrom = process.env.TWILIO_SMS_FROM || process.env.TWILIO_WHATSAPP_FROM?.replace("whatsapp:", "");

/**
 * POST /api/sms/send
 * 
 * Send SMS via Twilio
 * Body: { to: string, body: string, patientId?: string, metadata?: object }
 */
export async function POST(request: Request) {
  try {
    if (!accountSid || !authToken) {
      console.error("[SMS] Missing Twilio credentials");
      return NextResponse.json(
        { error: "Twilio not configured" },
        { status: 500 }
      );
    }

    const { to, toNumber, body, message, patientId, metadata } = await request.json() as {
      to?: string;
      toNumber?: string;
      body?: string;
      message?: string;
      patientId?: string | null;
      metadata?: Record<string, unknown>;
    };

    const phoneNumber = (toNumber || to || "").trim();
    const messageBody = (message || body || "").trim();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Missing required field: to/toNumber" },
        { status: 400 }
      );
    }

    if (!messageBody) {
      return NextResponse.json(
        { error: "Missing required field: body/message" },
        { status: 400 }
      );
    }

    // Normalize phone number to E.164 format
    let normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      // Assume Swiss number if no country code
      if (normalizedPhone.startsWith("0")) {
        normalizedPhone = "+41" + normalizedPhone.slice(1);
      } else {
        normalizedPhone = "+" + normalizedPhone;
      }
    }

    // Determine from number
    let fromNumber = smsFrom;
    if (!fromNumber) {
      console.error("[SMS] No SMS from number configured");
      return NextResponse.json(
        { error: "SMS from number not configured" },
        { status: 500 }
      );
    }
    
    // Clean the from number (remove whatsapp: prefix if present)
    fromNumber = fromNumber.replace("whatsapp:", "").trim();

    console.log(`[SMS] Sending to ${normalizedPhone} from ${fromNumber}`);

    const params = new URLSearchParams();
    params.append("From", fromNumber);
    params.append("To", normalizedPhone);
    params.append("Body", messageBody);

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
      }
    );

    const twilioBody = await twilioResponse.json().catch(() => null) as Record<string, unknown> | null;

    if (!twilioResponse.ok) {
      console.error("[SMS] Twilio error:", twilioResponse.status, twilioBody);
      return NextResponse.json(
        {
          error: "Failed to send SMS via Twilio",
          twilioStatus: twilioResponse.status,
          twilioBody,
        },
        { status: 502 }
      );
    }

    const sid = (twilioBody?.sid as string) ?? null;
    const sentAt = new Date().toISOString();

    console.log(`[SMS] Sent successfully, SID: ${sid}`);

    // Log to sms_logs table
    try {
      const logData: Record<string, unknown> = {
        to_number: normalizedPhone,
        from_number: fromNumber,
        message: messageBody,
        message_type: (metadata?.message_type as string) || "general",
        source: (metadata?.source as string) || "manual",
        twilio_sid: sid,
        status: "sent",
        metadata: metadata || {},
        created_at: sentAt,
      };

      // Add patient_id if provided
      if (patientId) {
        logData.patient_id = patientId;
      }

      const { error: logError } = await supabaseAdmin
        .from("sms_logs")
        .insert(logData);

      if (logError) {
        console.warn("[SMS] Failed to log to database:", logError.message);
      } else {
        console.log(`[SMS] Message logged to sms_logs table`);
      }
    } catch (dbError) {
      console.warn("[SMS] Could not log to database:", dbError);
    }

    return NextResponse.json({
      ok: true,
      sid,
      to: normalizedPhone,
      from: fromNumber,
      sentAt,
      metadata,
    });

  } catch (error) {
    console.error("[SMS] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
