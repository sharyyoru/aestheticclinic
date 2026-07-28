import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchAudience,
  substitutePatientVariables,
  type MarketingFilter,
  type PatientRow,
} from "@/lib/marketingFilters";
import { appendUnsubscribeFooter, createUnsubscribeUrl } from "@/lib/marketingUnsubscribe";

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
  workflowId?: string | null;
};

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";

// Marketing emails ALWAYS come from the clinic's branded address for
// deliverability (DKIM/SPF alignment) and consistent branding. Do not
// let the caller override this.
const MARKETING_FROM_EMAIL = "info@aesthetics-ge.ch";
const MARKETING_FROM_NAME = "Aesthetics Clinic";

type MailgunSendArgs = {
  to: string;
  subject: string;
  html: string;
  emailIdForTracking?: string | null;
  patientId?: string | null;
};

async function sendViaMailgun(args: MailgunSendArgs): Promise<{ ok: boolean; error?: string; messageId?: string; status?: number }> {
  if (!mailgunApiKey || !mailgunDomain) {
    return { ok: false, error: "Mailgun not configured (missing MAILGUN_API_KEY or MAILGUN_DOMAIN)" };
  }
  // Marketing emails ALWAYS come from the clinic's branded address, regardless
  // of what the caller passes. This ensures SPF/DKIM alignment with the
  // Mailgun sending domain and consistent brand identity.
  const fromAddress = MARKETING_FROM_EMAIL;
  const fromName = MARKETING_FROM_NAME;

  const unsubscribeUrl = args.patientId
    ? createUnsubscribeUrl(args.patientId, args.to)
    : null;
  let html = unsubscribeUrl
    ? appendUnsubscribeFooter(args.html, unsubscribeUrl)
    : args.html;
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
  form.append(
    "h:List-Unsubscribe",
    unsubscribeUrl
      ? `<${unsubscribeUrl}>, <mailto:unsubscribe@${mailgunDomain}?subject=unsubscribe>`
      : `<mailto:unsubscribe@${mailgunDomain}?subject=unsubscribe>`,
  );
  if (unsubscribeUrl) {
    form.append("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  }
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
    const text = await resp.text().catch(() => "");
    let json: { id?: string; message?: string } = {};
    try { json = JSON.parse(text); } catch { /* non-JSON response */ }
    if (!resp.ok) {
      console.error("[marketing/send] Mailgun rejected send", {
        status: resp.status,
        to: args.to,
        from: `${fromName} <${fromAddress}>`,
        body: text.slice(0, 500),
      });
      return { ok: false, status: resp.status, error: `Mailgun ${resp.status}: ${text.slice(0, 300)}` };
    }
    console.log("[marketing/send] Mailgun accepted", { to: args.to, messageId: json?.id });
    return { ok: true, messageId: json?.id, status: resp.status };
  } catch (err) {
    console.error("[marketing/send] Mailgun fetch threw", err);
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

async function processCampaign(
  campaignId: string,
  recipients: PatientRow[],
  subject: string,
  html: string,
) {
  const BATCH_SIZE = 20;
  const BATCH_DELAY_MS = 300;
  let sent = 0;
  let failed = 0;
  let firstError: string | null = null;
  const countStatus = async (status: string | string[]) => {
    let query = supabaseAdmin
      .from("marketing_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    query = Array.isArray(status) ? query.in("status", status) : query.eq("status", status);
    const { count } = await query;
    return count ?? 0;
  };

  try {
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const { data: optedOutRows } = await supabaseAdmin
        .from("patients")
        .select("id")
        .in("id", batch.map(patient => patient.id))
        .eq("marketing_opt_out", true);
      const optedOutIds = new Set((optedOutRows ?? []).map(patient => patient.id));
      await Promise.all(
        batch.map(async (patient) => {
          if (!patient.email) {
            failed += 1;
            return;
          }
          if (optedOutIds.has(patient.id)) {
            await supabaseAdmin
              .from("marketing_campaign_recipients")
              .update({ status: "skipped", error: "Patient unsubscribed from marketing emails" })
              .eq("campaign_id", campaignId)
              .eq("patient_id", patient.id)
              .eq("status", "pending");
            return;
          }

          const { data: claimedRecipient } = await supabaseAdmin
            .from("marketing_campaign_recipients")
            .update({
              status: "processing",
              processing_started_at: new Date().toISOString(),
            })
            .eq("campaign_id", campaignId)
            .eq("patient_id", patient.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();
          if (!claimedRecipient) return;

          let emailId: string | null = null;
          try {
            const { data: emailRow } = await supabaseAdmin
              .from("emails")
              .insert({
                patient_id: patient.id,
                to_address: patient.email,
                from_address: MARKETING_FROM_EMAIL,
                subject: substitutePatientVariables(subject, patient),
                body: substitutePatientVariables(html, patient),
                direction: "outbound",
                status: "sending",
              })
              .select("id")
              .single();
            emailId = emailRow?.id ?? null;
          } catch (error) {
            console.warn("[marketing/send] Failed to create email record", error);
          }

          const result = await sendViaMailgun({
            to: patient.email,
            subject: substitutePatientVariables(subject, patient),
            html: substitutePatientVariables(html, patient),
            emailIdForTracking: emailId,
            patientId: patient.id,
          });
          const now = new Date().toISOString();

          if (result.ok) {
            sent += 1;
            if (emailId) {
              await supabaseAdmin.from("emails").update({ status: "sent", sent_at: now }).eq("id", emailId);
            }
            await supabaseAdmin
              .from("marketing_campaign_recipients")
              .update({ status: "sent", sent_at: now, email_id: emailId, processing_started_at: null })
              .eq("campaign_id", campaignId)
              .eq("patient_id", patient.id);
          } else {
            failed += 1;
            firstError ||= result.error ?? "Unknown error";
            if (emailId) {
              await supabaseAdmin.from("emails").update({ status: "failed" }).eq("id", emailId);
            }
            await supabaseAdmin
              .from("marketing_campaign_recipients")
              .update({ status: "failed", error: result.error ?? "Unknown error", email_id: emailId, processing_started_at: null })
              .eq("campaign_id", campaignId)
              .eq("patient_id", patient.id);
          }
        }),
      );

      const [storedSent, storedOpened, storedFailed] = await Promise.all([
        countStatus(["sent", "opened"]),
        countStatus("opened"),
        countStatus("failed"),
      ]);
      await supabaseAdmin
        .from("marketing_campaigns")
        .update({
          total_sent: storedSent,
          total_failed: storedFailed,
          total_opened: storedOpened,
        })
        .eq("id", campaignId);

      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
  } catch (error) {
    firstError ||= error instanceof Error ? error.message : "Background campaign failed";
    failed = Math.max(failed, recipients.length - sent);
  }

  const [storedSent, storedOpened, storedFailed, storedPending, storedProcessing] = await Promise.all([
    countStatus(["sent", "opened"]),
    countStatus("opened"),
    countStatus("failed"),
    countStatus("pending"),
    countStatus("processing"),
  ]);
  const completed = storedPending === 0 && storedProcessing === 0;
  const finalStatus = completed
    ? storedFailed === 0
      ? "sent"
      : storedSent === 0
        ? "failed"
        : "partial"
    : "sending";
  await supabaseAdmin
    .from("marketing_campaigns")
    .update({
      status: finalStatus,
      total_sent: storedSent,
      total_failed: storedFailed,
      total_opened: storedOpened,
      total_recipients: storedSent + storedFailed + storedPending + storedProcessing,
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", campaignId);

  console.log("[marketing/send] Background campaign complete", {
    campaignId,
    sent: storedSent,
    failed: storedFailed,
    status: finalStatus,
    firstError,
  });
}

async function fetchCompleteAudience(filter: MarketingFilter): Promise<PatientRow[]> {
  const PAGE_SIZE = 1000;
  const recipients: PatientRow[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchAudience(supabaseAdmin, filter, {
      limit: PAGE_SIZE,
      offset,
    });
    recipients.push(...page.rows);
    offset += page.fetchedCount;

    if (page.fetchedCount < PAGE_SIZE) break;
  }

  return recipients;
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
    // A patient opt-out is absolute for bulk marketing sends, even if an old
    // saved list was created with less restrictive filter settings.
    filter = { ...filter, requireEmail: true, excludeOptOut: true };

    const subjectToUse = (body.subject && body.subject.trim()) || template.subject;

    // ----- TEST MODE: send a single rendered preview to testEmail -----
    if (body.testEmail && body.testEmail.trim()) {
      const testEmail = body.testEmail.trim().toLowerCase();
      const { data: matchingPatients, error: matchingError } = await supabaseAdmin
        .from("patients")
        .select("id, first_name, last_name, email, phone, dob, source, contact_owner_name, created_at, marketing_opt_out")
        .ilike("email", testEmail)
        .limit(10);
      if (matchingError) throw matchingError;
      if ((matchingPatients ?? []).some(patient => patient.marketing_opt_out)) {
        return NextResponse.json(
          { error: "This patient has unsubscribed from marketing emails." },
          { status: 409 },
        );
      }

      // Prefer the specified patient's data. For an address that is not tied
      // to a patient, use a generic test recipient.
      const matchingPatient = matchingPatients?.[0] as PatientRow | undefined;
      const samplePatient: PatientRow =
        matchingPatient ?? {
          id: "test",
          first_name: "Test",
          last_name: "Recipient",
          email: testEmail,
          phone: null,
          dob: null,
          source: null,
          contact_owner_name: null,
          created_at: null,
        };

      const subject = substitutePatientVariables(subjectToUse, samplePatient);
      const html = substitutePatientVariables(template.html, samplePatient);
      console.log("[marketing/send] Test send", {
        to: testEmail,
        subject: `[TEST] ${subject}`,
        samplePatient: samplePatient.id,
      });
      const result = await sendViaMailgun({
        to: testEmail,
        subject: `[TEST] ${subject}`,
        html,
        patientId: matchingPatient?.id ?? null,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Test send failed" }, { status: 502 });
      }
      return NextResponse.json({ ok: true, test: true, messageId: result.messageId });
    }

    // ----- REAL CAMPAIGN: fan out to all recipients -----
    const recipients = await fetchCompleteAudience(filter);
    console.log("[marketing/send] Campaign start", {
      campaignName: body.campaignName,
      templateId: body.templateId,
      subject: subjectToUse,
      recipientCount: recipients.length,
      sampleEmails: recipients.slice(0, 3).map((r) => r.email),
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
        workflow_id: body.workflowId ?? null,
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

    after(processCampaign(campaign.id, recipients, subjectToUse, template.html));

    return NextResponse.json({
      ok: true,
      queued: true,
      campaignId: campaign.id,
      totalRecipients: recipients.length,
      status: "sending",
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/marketing/campaigns/send] Error:", error);
    return NextResponse.json(
      { error: `Campaign send failed: ${message}` },
      { status: 500 },
    );
  }
}
