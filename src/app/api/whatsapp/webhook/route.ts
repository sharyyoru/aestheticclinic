import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Normalize phone number for comparison (strip +, spaces, dashes)
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\+\(\)]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const messageSid = formData.get("MessageSid") as string | null;
    const from = formData.get("From") as string | null;
    const to = formData.get("To") as string | null;
    const body = formData.get("Body") as string | null;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0", 10);
    const profileName = formData.get("ProfileName") as string | null;
    const accountSid = formData.get("AccountSid") as string | null;

    console.log("[WhatsApp Webhook] Received inbound message:", {
      messageSid,
      from,
      to,
      body: body?.substring(0, 50),
      numMedia,
      profileName,
    });

    if (!messageSid || !from) {
      console.error("[WhatsApp Webhook] Missing required fields");
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const cleanFrom = from.replace("whatsapp:", "").trim();
    const cleanTo = to?.replace("whatsapp:", "").trim() || null;
    const normalizedFrom = normalizePhone(cleanFrom);

    // Find patient by phone number (try multiple formats)
    let patientId: string | null = null;
    let patientName: string | null = null;
    
    const { data: patients } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, phone")
      .limit(100);

    if (patients) {
      const match = patients.find((p: any) => {
        const pPhone = normalizePhone(p.phone || "");
        return pPhone === normalizedFrom || 
               pPhone.endsWith(normalizedFrom) || 
               normalizedFrom.endsWith(pPhone);
      });
      if (match) {
        patientId = match.id;
        patientName = `${match.first_name || ""} ${match.last_name || ""}`.trim();
      }
    }

    console.log("[WhatsApp Webhook] Patient lookup:", { patientId, patientName, cleanFrom });

    // Collect media URLs
    const mediaUrls: string[] = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`) as string | null;
        if (mediaUrl) mediaUrls.push(mediaUrl);
      }
    }

    // Insert the message
    const { data: insertedMessage, error: insertError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        provider_message_sid: messageSid,
        patient_id: patientId,
        from_number: cleanFrom,
        to_number: cleanTo || "",
        body: body || "",
        direction: "inbound",
        status: "delivered",
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        media_url: mediaUrls.length > 0 ? mediaUrls[0] : null,
        metadata: {
          profile_name: profileName,
          account_sid: accountSid,
          num_media: numMedia,
          all_media_urls: mediaUrls,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[WhatsApp Webhook] Failed to store message:", insertError);
      return new NextResponse("Database error", { status: 500 });
    }

    const messageId = insertedMessage?.id;

    // Update conversation window tracking
    if (patientId) {
      const now = new Date();
      const windowExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      await supabaseAdmin
        .from("whatsapp_conversations")
        .upsert(
          {
            patient_id: patientId,
            phone_number: cleanFrom,
            last_message_at: now.toISOString(),
            last_message_preview: body?.substring(0, 100) || "",
            last_inbound_at: now.toISOString(),
            window_expires_at: windowExpiresAt,
            updated_at: now.toISOString(),
          },
          { onConflict: "patient_id,phone_number" }
        );

      // Find deal owner to notify
      const { data: deals } = await supabaseAdmin
        .from("deals")
        .select("id, owner_id, owner_name")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1);

      const deal = deals?.[0];
      
      if (deal?.owner_id && messageId) {
        // Create notification for deal owner
        const { error: notifError } = await supabaseAdmin
          .from("whatsapp_notifications")
          .insert({
            user_id: deal.owner_id,
            message_id: messageId,
            patient_id: patientId,
            title: `WhatsApp from ${patientName || cleanFrom}`,
            body: body?.substring(0, 200) || "(Media message)",
          });

        if (notifError) {
          console.error("[WhatsApp Webhook] Failed to create notification:", notifError);
        } else {
          console.log("[WhatsApp Webhook] Notified deal owner:", deal.owner_name, deal.owner_id);
        }

        // Also create a standard notification
        await supabaseAdmin.from("notifications").insert({
          user_id: deal.owner_id,
          type: "whatsapp_reply",
          title: `WhatsApp reply from ${patientName || "Patient"}`,
          message: body?.substring(0, 200) || "(Media message)",
          link: `/patients/${patientId}?m_tab=crm&crm_sub=whatsapp`,
          metadata: {
            patient_id: patientId,
            message_id: messageId,
            from_number: cleanFrom,
          },
        });
      }
    }

    console.log("[WhatsApp Webhook] Successfully processed inbound message");

    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("[WhatsApp Webhook] Unexpected error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "WhatsApp webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
