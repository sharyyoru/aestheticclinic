import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchAudience,
  substitutePatientVariables,
  type MarketingFilter,
  type PatientRow,
  MAX_CAMPAIGN_RECIPIENTS,
} from "@/lib/marketingFilters";

export const runtime = "nodejs";
export const maxDuration = 300;

type SendRequestBody = {
  campaignName?: string;
  templateId?: string;
  subject?: string;              // overrides template subject if provided
  filter?: MarketingFilter;
  listId?: string | null;
  testEmail?: string | null;     // when set, only send a single test to this address
  userId?: string | null;
  fromUserEmail?: string | null;
  fromUserName?: string | null;
};

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";

type MailgunSendArgs = {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string | null;
  fromName?: string | null;
  emailIdForTracking?: string | null;
};

async function sendViaMailgun(args: MailgunSendArgs): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  if (!mailgunApiKey || !mailgunDomain) {
    return { ok: false, error: "Mailgun not configured" };
  }
  const fromAddress = (args.fromEmail && args.fromEmail.trim()) || mailgunFromEmail || `clinic@${mailgunDomain}`;
  const fromName = (args.fromName && args.fromName.trim()) || mailgunFromName;

  let html = args.html;
  if (args.emailIdForTracking) {
    const pixel = `<img src="${appUrl}/api/emails/track?id=${args.emailIdForTracking}" width="1" height="1" style="display:none;visibility:hidden;width:1px;height:1px;opacity:0;" alt="" />`;
    html = html.includes("</body>")
      ? html.replace("</body>", `${pixel}</body>`)
      : `${html}${pixel}`;
  }

  const form = new FormData();
  form.append("from", `${fromName} <${fromAddress}>`);
  form.append("to", args.to);
  form.append("subject", args.subject);
  form.append("html", html);
  // Marketing headers (help downstream mail servers classify correctly)
  form.append("h:List-Unsubscribe", `<mailto:unsubscribe@${mailgunDomain}?subject=unsubscribe>`);
  if (args.emailIdForTracking) {
    form.append("v:email-id", args.emailIdForTracking);
    form.append("v:source", "marketing_campaign");
  }

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");
  try {
    const resp = await fetch(`${mailgunApiBaseUrl}/v3/${mailgunDomain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, error: `Mailgun ${resp.status}: ${text.slice(0, 200)}` };
    }
    const json = await resp.json().catch(() => ({}));
    return { ok: true, messageId: json?.id ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function loadTemplate(templateId: string): Promise<{ subject: string; html: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("subject_template, html_content, body_template")
    .eq("id", templateId)
    .maybeSingle();
  if (error || !data) return null;
  const html = (data.html_content as string | null) || (data.body_template as string | null) || "";
  return {
    subject: (data.subject_template as string) || "",
    html,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendRequestBody;
    if (!body.templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }
    if (!body.filter && !body.listId) {
      return NextResponse.json({ error: "filter or listId is required" }, { status: 400 });
    }

    const template = await loadTemplate(body.templateId);
    if (!template || (!template.html && !template.subject)) {
      return NextResponse.json({ error: "Template not found or empty" }, { status: 404 });
    }

    // Resolve filter (prefer saved list when provided)
    let filter: MarketingFilter = body.filter ?? {};
    if (body.listId) {
      const { data: list } = await supabaseAdmin
        .from("marketing_lists")
        .select("filter")
        .eq("id", body.listId)
        .maybeSingle();
      if (list?.filter) {
        filter = list.filter as MarketingFilter;
      }
    }

    const subjectToUse = (body.subject && body.subject.trim()) || template.subject;

    // ----- TEST MODE: send a single rendered preview to testEmail -----
    if (body.testEmail && body.testEmail.trim()) {
      // Use the first matching audience row as sample data (or a placeholder)
      const { rows: sample } = await fetchAudience(supabaseAdmin, filter, { limit: 1 });
      const samplePatient: PatientRow =
        sample[0] ?? {
          id: "test",
          first_name: "Test",
          last_name: "Recipient",
          email: body.testEmail,
          phone: null,
          dob: null,
          source: null,
          contact_owner_name: null,
          created_at: null,
        };

      const subject = substitutePatientVariables(subjectToUse, samplePatient);
      const html = substitutePatientVariables(template.html, samplePatient);
      const result = await sendViaMailgun({
        to: body.testEmail.trim(),
        subject: `[TEST] ${subject}`,
        html,
        fromEmail: body.fromUserEmail,
        fromName: body.fromUserName,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Test send failed" }, { status: 502 });
      }
      return NextResponse.json({ ok: true, test: true, messageId: result.messageId });
    }

    // ----- REAL CAMPAIGN: fan out to all recipients -----
    const { rows: recipients } = await fetchAudience(supabaseAdmin, filter, {
      limit: MAX_CAMPAIGN_RECIPIENTS,
    });
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipients match this filter" },
        { status: 400 },
      );
    }

    // Create campaign header
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("marketing_campaigns")
      .insert({
        name: (body.campaignName || `Campaign ${new Date().toISOString().slice(0, 10)}`).trim(),
        list_id: body.listId ?? null,
        filter_snapshot: filter,
        template_id: body.templateId,
        subject: subjectToUse,
        html_snapshot: template.html,
        status: "sending",
        total_recipients: recipients.length,
        created_by: body.userId ?? null,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: `Failed to create campaign: ${campaignError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    // Insert all recipient rows up front (pending)
    const recipientRows = recipients.map((r) => ({
      campaign_id: campaign.id,
      patient_id: r.id,
      email: (r.email ?? "").trim(),
      status: r.email ? "pending" : "skipped",
    }));
    // Chunk inserts to stay within Supabase row limits
    for (let i = 0; i < recipientRows.length; i += 500) {
      const slice = recipientRows.slice(i, i + 500);
      await supabaseAdmin.from("marketing_campaign_recipients").insert(slice);
    }

    // Send in batches with a small delay between batches to be gentle on Mailgun
    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 300;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (patient) => {
          if (!patient.email) {
            failed += 1;
            return;
          }

          // Create an email record in CRM for tracking
          const { data: emailRow } = await supabaseAdmin
            .from("emails")
            .insert({
              patient_id: patient.id,
              to_address: patient.email,
              from_address:
                (body.fromUserEmail && body.fromUserEmail.trim()) ||
                mailgunFromEmail ||
                (mailgunDomain ? `clinic@${mailgunDomain}` : ""),
              subject: substitutePatientVariables(subjectToUse, patient),
              body: substitutePatientVariables(template.html, patient),
              direction: "outbound",
              status: "sending",
            })
            .select("id")
            .single();

          const emailId: string | null = emailRow?.id ?? null;

          const result = await sendViaMailgun({
            to: patient.email,
            subject: substitutePatientVariables(subjectToUse, patient),
            html: substitutePatientVariables(template.html, patient),
            fromEmail: body.fromUserEmail,
            fromName: body.fromUserName,
            emailIdForTracking: emailId,
          });

          const now = new Date().toISOString();
          if (result.ok) {
            sent += 1;
            if (emailId) {
              await supabaseAdmin
                .from("emails")
                .update({ status: "sent", sent_at: now })
                .eq("id", emailId);
            }
            await supabaseAdmin
              .from("marketing_campaign_recipients")
              .update({
                status: "sent",
                sent_at: now,
                email_id: emailId,
              })
              .eq("campaign_id", campaign.id)
              .eq("patient_id", patient.id);
          } else {
            failed += 1;
            if (emailId) {
              await supabaseAdmin
                .from("emails")
                .update({ status: "failed" })
                .eq("id", emailId);
            }
            await supabaseAdmin
              .from("marketing_campaign_recipients")
              .update({
                status: "failed",
                error: result.error ?? "Unknown error",
                email_id: emailId,
              })
              .eq("campaign_id", campaign.id)
              .eq("patient_id", patient.id);
          }
        }),
      );

      // Update running totals on the campaign
      await supabaseAdmin
        .from("marketing_campaigns")
        .update({ total_sent: sent, total_failed: failed })
        .eq("id", campaign.id);

      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // Finalise status
    const finalStatus = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
    await supabaseAdmin
      .from("marketing_campaigns")
      .update({
        status: finalStatus,
        total_sent: sent,
        total_failed: failed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return NextResponse.json({
      ok: true,
      campaignId: campaign.id,
      totalRecipients: recipients.length,
      sent,
      failed,
      status: finalStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/marketing/campaigns/send] Error:", error);
    return NextResponse.json(
      { error: `Campaign send failed: ${message}` },
      { status: 500 },
    );
  }
}
