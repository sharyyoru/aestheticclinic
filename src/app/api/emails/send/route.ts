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

function sanitizeTelLinks(html: string): string {
  // First, decode any URL-encoded tel: protocols (tel%3A -> tel:)
  let result = html.replace(/href\s*=\s*(["'])tel%3A/gi, 'href=$1tel:');
  
  // Also handle %2B (URL-encoded +) at the start of phone numbers
  result = result.replace(/href\s*=\s*(["'])tel:%2B/gi, 'href=$1tel:+');
  
  // Now handle all tel: links and clean the phone numbers for iPhone compatibility
  result = result.replace(
    /href\s*=\s*["']tel:([^"']+)["']/gi,
    (_match, phoneNumber) => {
      // Decode any remaining URL encoding in the phone number
      let decoded = phoneNumber;
      try {
        decoded = decodeURIComponent(phoneNumber);
      } catch {
        // If decoding fails, use original
      }
      // Remove HTML entities first
      decoded = decoded
        .replace(/&nbsp;/gi, '')  // HTML nbsp entity
        .replace(/&#160;/g, '')   // Numeric nbsp entity
        .replace(/&amp;/gi, '&')  // Ampersand entity
        .replace(/&plus;/gi, '+') // Plus entity
        .replace(/\u00A0/g, '');  // Unicode nbsp
      
      // CRITICAL FOR iPHONE: Keep ONLY digits and leading + sign
      // Remove everything else (letters, spaces, dashes, dots, parens, etc.)
      const cleaned = decoded.replace(/[^0-9+]/g, '');
      
      return `href="tel:${cleaned}"`;
    }
  );
  
  return result;
}

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
    
    // Sanitize tel: links for iPhone compatibility
    const sanitizedHtml = sanitizeTelLinks(trimmedHtml);
    
    // Add tracking pixel to the email HTML for read tracking
    let htmlWithTracking = sanitizedHtml;
    if (emailId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";
      const trackingPixel = `<img src="${appUrl}/api/emails/track?id=${emailId}" width="1" height="1" style="display:none;visibility:hidden;width:1px;height:1px;opacity:0;" alt="" />`;
      // Insert tracking pixel before closing </body> tag, or at the end if no </body>
      if (htmlWithTracking.includes("</body>")) {
        htmlWithTracking = htmlWithTracking.replace("</body>", `${trackingPixel}</body>`);
      } else {
        htmlWithTracking = `${htmlWithTracking}${trackingPixel}`;
      }
    }
    formData.append("html", htmlWithTracking);
    
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
    
    // NOTE: Do NOT CC the tracking address - it causes an infinite loop in the webhook!
    // The Reply-To header is sufficient for capturing patient replies.
    
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
                .from("email-attachments")
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
