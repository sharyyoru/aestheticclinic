import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { substitutePatientVariables, type PatientRow } from "@/lib/marketingFilters";
import { appendUnsubscribeFooter, createUnsubscribeUrl } from "@/lib/marketingUnsubscribe";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 100;
const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";
const FROM_EMAIL = "info@aesthetics-ge.ch";
const FROM_NAME = "Aesthetics Clinic";

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  emailId: string | null,
  patientId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!mailgunApiKey || !mailgunDomain) {
    return { ok: false, error: "Mailgun is not configured" };
  }

  const unsubscribeUrl = patientId ? createUnsubscribeUrl(patientId, to) : null;
  const emailHtml = unsubscribeUrl ? appendUnsubscribeFooter(html, unsubscribeUrl) : html;
  const pixel = emailId
    ? `<img src="${appUrl}/api/emails/track?id=${emailId}" width="1" height="1" style="display:none" alt="" />`
    : "";
  const trackedHtml = emailHtml.includes("</body>")
    ? emailHtml.replace("</body>", `${pixel}</body>`)
    : `${emailHtml}${pixel}`;
  const form = new FormData();
  form.append("from", `${FROM_NAME} <${FROM_EMAIL}>`);
  form.append("to", to);
  form.append("subject", subject);
  form.append("html", trackedHtml);
  form.append(
    "h:List-Unsubscribe",
    unsubscribeUrl
      ? `<${unsubscribeUrl}>, <mailto:unsubscribe@${mailgunDomain}?subject=unsubscribe>`
      : `<mailto:unsubscribe@${mailgunDomain}?subject=unsubscribe>`,
  );
  if (unsubscribeUrl) {
    form.append("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  }
  if (emailId) {
    form.append("v:email-id", emailId);
    form.append("v:source", "marketing_campaign");
  }

  try {
    const response = await fetch(`${mailgunApiBaseUrl}/v3/${mailgunDomain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString("base64")}`,
      },
      body: form,
    });
    if (response.ok) return { ok: true };
    return { ok: false, error: `Mailgun ${response.status}: ${(await response.text()).slice(0, 300)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Mailgun request failed" };
  }
}

async function countRecipients(campaignId: string, status: string | string[]) {
  let query = supabaseAdmin
    .from("marketing_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  query = Array.isArray(status) ? query.in("status", status) : query.eq("status", status);
  const { count } = await query;
  return count ?? 0;
}

async function processCampaign(campaign: {
  id: string;
  subject: string;
  html_snapshot: string | null;
  total_recipients: number;
}) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("marketing_campaign_recipients")
    .update({ status: "pending", processing_started_at: null })
    .eq("campaign_id", campaign.id)
    .eq("status", "processing")
    .lt("processing_started_at", staleBefore);

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("marketing_campaign_recipients")
    .select("id, patient_id, email")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .limit(BATCH_SIZE);
  if (pendingError) throw pendingError;

  const patientIds = (pending ?? []).map(row => row.patient_id).filter((id): id is string => !!id);
  const { data: patients } = patientIds.length
    ? await supabaseAdmin
        .from("patients")
        .select("id, first_name, last_name, email, phone, dob, source, contact_owner_name, created_at, marketing_opt_out")
        .in("id", patientIds)
    : { data: [] };
  const patientMap = new Map((patients ?? []).map(patient => [patient.id, patient as PatientRow]));

  await Promise.all((pending ?? []).map(async recipient => {
    const currentPatient = recipient.patient_id ? patientMap.get(recipient.patient_id) : undefined;
    if (currentPatient?.marketing_opt_out) {
      await supabaseAdmin
        .from("marketing_campaign_recipients")
        .update({
          status: "skipped",
          error: "Patient unsubscribed from marketing emails",
          processing_started_at: null,
        })
        .eq("id", recipient.id)
        .eq("status", "pending");
      return;
    }

    const { data: claimed } = await supabaseAdmin
      .from("marketing_campaign_recipients")
      .update({ status: "processing", processing_started_at: new Date().toISOString() })
      .eq("id", recipient.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    const patient = currentPatient;
    const variables: PatientRow = patient ?? {
      id: recipient.patient_id ?? recipient.id,
      first_name: null,
      last_name: null,
      email: recipient.email,
      phone: null,
      dob: null,
      source: null,
      contact_owner_name: null,
      created_at: null,
    };
    const subject = substitutePatientVariables(campaign.subject, variables);
    const html = substitutePatientVariables(campaign.html_snapshot ?? "", variables);

    let emailId: string | null = null;
    if (recipient.patient_id) {
      const { data: emailRow } = await supabaseAdmin
        .from("emails")
        .insert({
          patient_id: recipient.patient_id,
          to_address: recipient.email,
          from_address: FROM_EMAIL,
          subject,
          body: html,
          direction: "outbound",
          status: "sending",
        })
        .select("id")
        .single();
      emailId = emailRow?.id ?? null;
    }

    const result = await sendEmail(recipient.email, subject, html, emailId, recipient.patient_id);
    const now = new Date().toISOString();
    if (result.ok) {
      if (emailId) {
        await supabaseAdmin.from("emails").update({ status: "sent", sent_at: now }).eq("id", emailId);
      }
      await supabaseAdmin
        .from("marketing_campaign_recipients")
        .update({ status: "sent", sent_at: now, email_id: emailId, processing_started_at: null })
        .eq("id", recipient.id);
    } else {
      if (emailId) {
        await supabaseAdmin.from("emails").update({ status: "failed" }).eq("id", emailId);
      }
      await supabaseAdmin
        .from("marketing_campaign_recipients")
        .update({ status: "failed", error: result.error, email_id: emailId, processing_started_at: null })
        .eq("id", recipient.id);
    }
  }));

  const [sent, opened, failed, pendingCount, processing] = await Promise.all([
    countRecipients(campaign.id, ["sent", "opened"]),
    countRecipients(campaign.id, "opened"),
    countRecipients(campaign.id, "failed"),
    countRecipients(campaign.id, "pending"),
    countRecipients(campaign.id, "processing"),
  ]);
  const completed = pendingCount === 0 && processing === 0;
  const status = completed ? (failed === 0 ? "sent" : sent === 0 ? "failed" : "partial") : "sending";
  await supabaseAdmin
    .from("marketing_campaigns")
    .update({
      status,
      total_sent: sent,
      total_failed: failed,
      total_opened: opened,
      total_recipients: sent + failed + pendingCount + processing,
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", campaign.id);

  return { campaignId: campaign.id, sent, failed, pending: pendingCount, processing, status };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from("marketing_campaigns")
      .select("id, subject, html_snapshot, total_recipients")
      .eq("status", "sending")
      .order("started_at", { ascending: true })
      .limit(3);
    if (error) throw error;

    const results = [];
    for (const campaign of campaigns ?? []) {
      results.push(await processCampaign(campaign));
    }
    return NextResponse.json({ ok: true, processed: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign recovery failed";
    console.error("[cron/process-marketing-campaigns]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = GET;
