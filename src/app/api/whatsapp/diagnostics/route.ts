import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  const credentialStatus = {
    accountSid_set: Boolean(accountSid),
    authToken_set: Boolean(authToken),
    whatsappFrom_set: Boolean(whatsappFrom),
    whatsappFrom_value: whatsappFrom || null,
  };

  const { data: templates, error } = await supabaseAdmin
    .from("whatsapp_templates")
    .select("name, language, status, twilio_content_sid, body")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, credentials: credentialStatus },
      { status: 500 },
    );
  }

  const requiredTemplates = [
    "booking_link_en",
    "booking_link_fr",
    "cancellation_policy_en",
    "cancellation_policy_fr",
    "lead_treatment_optimisation_en",
    "lead_treatment_optimisation_fr",
  ];

  const templateStatus = requiredTemplates.map((name) => {
    const rows = templates?.filter((t) => t.name === name) || [];
    const approved = rows.find((t) => t.status === "approved" && t.twilio_content_sid);
    const anyRow = rows[0];
    return {
      name,
      found: rows.length > 0,
      approved: Boolean(approved),
      content_sid: approved?.twilio_content_sid || anyRow?.twilio_content_sid || null,
      status: approved?.status || anyRow?.status || "missing",
      body_preview: anyRow?.body?.slice(0, 80) || null,
    };
  });

  // Show every synced template so we can spot approved ones with different names.
  const allSyncedTemplates = (templates || [])
    .filter((t) => t.twilio_content_sid && t.status)
    .map((t) => ({
      name: t.name,
      language: t.language,
      status: t.status,
      content_sid: t.twilio_content_sid,
      body_preview: t.body?.slice(0, 80) || null,
    }));

  return NextResponse.json({
    ok: true,
    credentials: credentialStatus,
    templates: templateStatus,
    allSyncedTemplates,
    note:
      "For WhatsApp to work, every template listed above must have status='approved' and a non-null twilio_content_sid. " +
      "Create and submit the templates in Twilio Content Template Builder, then call POST /api/whatsapp/templates/sync. " +
      "If your approved templates have different names, use allSyncedTemplates to find them and update the code accordingly.",
  });
}
