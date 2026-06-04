import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// POST /api/whatsapp/status-callback
// Receives Twilio message status events: sent, delivered, read, failed, undelivered
// Configured via StatusCallback param on every Twilio send in /api/whatsapp/send
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const messageSid    = formData.get("MessageSid") as string | null;
    const messagStatus  = formData.get("MessageStatus") as string | null;
    const errorCode     = formData.get("ErrorCode") as string | null;
    const errorMessage  = formData.get("ErrorMessage") as string | null;

    if (!messageSid || !messagStatus) {
      return new NextResponse("Missing MessageSid or MessageStatus", { status: 400 });
    }

    console.log("WhatsApp status callback:", { messageSid, messagStatus, errorCode });

    // Build the update payload
    const updates: Record<string, unknown> = { status: messagStatus };

    if (messagStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    if (messagStatus === "read") {
      updates.read_at = new Date().toISOString();
      // Also set delivered_at if not already set (read implies delivered)
      updates.delivered_at = new Date().toISOString();
    }

    if (messagStatus === "failed" || messagStatus === "undelivered") {
      const parts = [errorCode, errorMessage].filter(Boolean);
      updates.error_message = parts.length > 0 ? parts.join(": ") : "Delivery failed";
    }

    const { error } = await supabaseAdmin
      .from("whatsapp_messages")
      .update(updates)
      .eq("message_sid", messageSid);

    if (error) {
      console.error("Failed to update whatsapp_messages status:", error);
      // Still return 204 so Twilio does not retry indefinitely
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Unexpected error in /api/whatsapp/status-callback:", err);
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "WhatsApp status callback endpoint is active" });
}
