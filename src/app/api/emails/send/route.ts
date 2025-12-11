import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!mailgunApiKey || !mailgunDomain) {
  throw new Error("Missing MAILGUN_API_KEY or MAILGUN_DOMAIN environment variables");
}

type EmailAttachmentRow = {
  id: string;
  email_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
};

export async function POST(request: Request) {
  try {
    const { to, subject, html, fromUserEmail, fromUserName, emailId, patientId } = (await request.json()) as {
      to?: string;
      subject?: string;
      html?: string;
      fromUserEmail?: string | null;
      fromUserName?: string | null;
      emailId?: string | null;
      patientId?: string | null;
    };

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 },
      );
    }

    const trimmedTo = to.trim();
    const trimmedSubject = subject.trim();
    const trimmedHtml = html.trim();

    if (!trimmedTo || !trimmedSubject || !trimmedHtml) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 },
      );
    }

    const domain = mailgunDomain as string;

    // Use the user's email if provided (must be verified in Mailgun)
    // Otherwise fall back to the default Mailgun from email
    let fromAddress = mailgunFromEmail || `clinic@${domain}`;
    let fromName = mailgunFromName;
    
    if (fromUserEmail && fromUserEmail.trim().length > 0) {
      // Use user's actual email as sender
      fromAddress = fromUserEmail.trim();
      // Use provided name or extract from email
      if (fromUserName && fromUserName.trim().length > 0) {
        fromName = fromUserName.trim();
      } else {
        const emailPrefix = fromUserEmail.split("@")[0];
        fromName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      }
    }

    // Use FormData to support file attachments
    const formData = new FormData();
    formData.append("from", `${fromName} <${fromAddress}>`);
    formData.append("to", trimmedTo);
    formData.append("subject", trimmedSubject);
    formData.append("html", trimmedHtml);
    
    // Create a unique reply-to address with embedded email ID for tracking
    // Format: reply+{emailId}+{patientId}@mg.domain.com
    // This allows us to track which email the reply is for
    let replyToAddress = `clinic@${domain}`;
    if (emailId && patientId) {
      replyToAddress = `reply+${emailId}+${patientId}@${domain}`;
    } else if (emailId) {
      replyToAddress = `reply+${emailId}@${domain}`;
    }
    formData.append("h:Reply-To", replyToAddress);
    
    // Also CC the tracking address so we always get a copy
    formData.append("cc", replyToAddress);
    
    // Add custom headers for reply tracking and metadata
    if (emailId) {
      formData.append("v:email-id", emailId);
    }
    if (patientId) {
      formData.append("v:patient-id", patientId);
    }
    if (fromUserEmail && fromUserEmail.trim().length > 0) {
      formData.append("v:sent-by", fromUserEmail.trim());
    }

    // Fetch and attach files from Supabase Storage if emailId is provided
    if (emailId && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: attachments, error: attachmentsError } = await supabase
          .from("email_attachments")
          .select("id, email_id, file_name, storage_path, mime_type, file_size")
          .eq("email_id", emailId);

        if (!attachmentsError && attachments && attachments.length > 0) {
          for (const att of attachments as EmailAttachmentRow[]) {
            try {
              const { data: fileData, error: downloadError } = await supabase.storage
                .from("email_attachments")
                .download(att.storage_path);

              if (!downloadError && fileData) {
                // Convert Blob to File for FormData
                const file = new File([fileData], att.file_name, {
                  type: att.mime_type || "application/octet-stream",
                });
                formData.append("attachment", file, att.file_name);
              } else {
                console.error("Error downloading attachment:", att.file_name, downloadError);
              }
            } catch (dlError) {
              console.error("Error processing attachment:", att.file_name, dlError);
            }
          }
        }
      } catch (attError) {
        console.error("Error fetching attachments:", attError);
      }
    }

    const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

    const response = await fetch(`${mailgunApiBaseUrl}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Error sending email via Mailgun", response.status, text);
      return NextResponse.json(
        {
          error: "Failed to send email via Mailgun",
          mailgunStatus: response.status,
          mailgunBody: text,
        },
        { status: 502 },
      );
    }

    // Get the Message-ID from Mailgun response for reply tracking
    const mailgunResponse = await response.json();
    const messageId = mailgunResponse.id || null;

    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    console.error("Error sending email via Mailgun", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
