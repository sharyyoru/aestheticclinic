import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractReplyContent } from "@/utils/emailCleaner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AttachmentInfo = {
  fileName: string;
  contentType: string;
  data: ArrayBuffer;
  size: number;
};

export async function POST(request: Request) {
  // Log that webhook was hit - this helps debug if Mailgun is reaching us
  console.log("=== MAILGUN INBOUND WEBHOOK HIT ===");
  console.log("Timestamp:", new Date().toISOString());
  
  try {
    // Parse the incoming webhook data from Mailgun
    const formData = await request.formData();
    
    // Log all form data keys for debugging
    const formDataKeys = Array.from(formData.keys());
    console.log("Form data keys received:", formDataKeys);
    
    const from = formData.get("from")?.toString() || formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || formData.get("to")?.toString() || formData.get("recipient")?.toString() || "";
    const subject = formData.get("Subject")?.toString() || formData.get("subject")?.toString() || "";
    const bodyPlain = formData.get("body-plain")?.toString() || "";
    const bodyHtml = formData.get("body-html")?.toString() || "";
    const timestamp = formData.get("timestamp")?.toString() || "";
    const inReplyTo = formData.get("In-Reply-To")?.toString() || "";
    const references = formData.get("References")?.toString() || "";
    
    // Log key email details
    console.log("INBOUND EMAIL DETAILS:");
    console.log("  From:", from);
    console.log("  To:", to);
    console.log("  Subject:", subject);
    console.log("  Body length:", (bodyPlain || bodyHtml).length);
    
    // Get custom variables we set when sending
    const emailId = formData.get("email-id")?.toString() || "";
    const patientId = formData.get("patient-id")?.toString() || "";
    
    // Mailgun sends attachment count and individual attachments
    const attachmentCountStr = formData.get("attachment-count")?.toString() || "0";
    const attachmentCount = parseInt(attachmentCountStr, 10) || 0;
    
    // Collect attachments from form data
    const attachments: AttachmentInfo[] = [];
    
    // Mailgun sends attachments as "attachment-1", "attachment-2", etc. or just "attachment"
    for (let i = 1; i <= Math.max(attachmentCount, 10); i++) {
      const attachment = formData.get(`attachment-${i}`) as File | null;
      if (attachment && attachment instanceof File) {
        try {
          const arrayBuffer = await attachment.arrayBuffer();
          attachments.push({
            fileName: attachment.name || `attachment-${i}`,
            contentType: attachment.type || "application/octet-stream",
            data: arrayBuffer,
            size: attachment.size,
          });
        } catch (err) {
          console.error(`Error reading attachment-${i}:`, err);
        }
      }
    }
    
    // Also check for generic "attachment" field (some Mailgun configurations)
    const genericAttachment = formData.get("attachment") as File | null;
    if (genericAttachment && genericAttachment instanceof File) {
      try {
        const arrayBuffer = await genericAttachment.arrayBuffer();
        attachments.push({
          fileName: genericAttachment.name || "attachment",
          contentType: genericAttachment.type || "application/octet-stream",
          data: arrayBuffer,
          size: genericAttachment.size,
        });
      } catch (err) {
        console.error("Error reading generic attachment:", err);
      }
    }
    
    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let targetPatientId = patientId;
    let targetEmailId = emailId;
    let originalSubject = subject;
    
    // Method 0: Parse smart CC/Reply-To address (format: reply+{emailId}+{patientId}@domain)
    // Check both "to" and "cc" fields for the tracking address
    const allRecipients = `${to} ${formData.get("Cc")?.toString() || ""}`;
    const smartAddressMatch = allRecipients.match(/reply\+([a-f0-9-]+)\+([a-f0-9-]+)@/i);
    if (smartAddressMatch) {
      targetEmailId = smartAddressMatch[1];
      targetPatientId = smartAddressMatch[2];
      console.log("Parsed smart address - emailId:", targetEmailId, "patientId:", targetPatientId);
    } else {
      // Try format with just emailId: reply+{emailId}@domain
      const simpleMatch = allRecipients.match(/reply\+([a-f0-9-]+)@/i);
      if (simpleMatch) {
        targetEmailId = simpleMatch[1];
        console.log("Parsed simple smart address - emailId:", targetEmailId);
      }
    }
    
    // If we found emailId from smart address, look up the patient
    if (targetEmailId && !targetPatientId) {
      const { data: originalEmail } = await supabase
        .from("emails")
        .select("patient_id, subject")
        .eq("id", targetEmailId)
        .single();
      
      if (originalEmail) {
        targetPatientId = originalEmail.patient_id;
        originalSubject = originalEmail.subject;
        console.log("Found patient from emailId:", targetPatientId);
      }
    }
    
    // Try to find the original email using multiple methods if still not found
    if (!targetPatientId) {
      // Method 1: Check if this is a reply using In-Reply-To header
      if (inReplyTo) {
        const { data: originalEmail } = await supabase
          .from("emails")
          .select("patient_id, subject")
          .eq("message_id", inReplyTo)
          .single();
        
        if (originalEmail) {
          targetPatientId = originalEmail.patient_id;
          originalSubject = originalEmail.subject;
        }
      }
      
      // Method 2: Check References header (thread tracking)
      if (!targetPatientId && references) {
        const messageIds = references.split(/\s+/).filter(Boolean);
        if (messageIds.length > 0) {
          const { data: originalEmail } = await supabase
            .from("emails")
            .select("patient_id, subject")
            .in("message_id", messageIds)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          
          if (originalEmail) {
            targetPatientId = originalEmail.patient_id;
            originalSubject = originalEmail.subject;
          }
        }
      }
      
      // Method 3: Try to find by matching sender email (the "from" in the reply is the patient)
      if (!targetPatientId) {
        // Extract email from "Name <email@domain.com>" format
        const emailMatch = from.match(/<([^>]+)>/) || [null, from];
        const senderEmail = emailMatch[1]?.trim() || from.trim();
        
        const { data: patient } = await supabase
          .from("patients")
          .select("id")
          .eq("email", senderEmail)
          .single();
        
        if (patient) {
          targetPatientId = patient.id;
        }
      }
    }
    
    // Clean the email body to remove signatures and quoted text
    const rawBody = bodyHtml || bodyPlain;
    const isHtml = !!bodyHtml;
    const cleanedBody = extractReplyContent(rawBody, isHtml);
    
    // Extract sender email
    const emailMatch = from.match(/<([^>]+)>/) || [null, from];
    const senderEmail = emailMatch[1]?.trim() || from.trim();
    
    // IMPORTANT: Check if sender is a clinic user - if so, this is a CC'd copy of an outbound email
    // We should NOT log this as an inbound email (it would create a duplicate)
    const { data: senderIsClinicUser } = await supabase
      .from("users")
      .select("id")
      .ilike("email", senderEmail)
      .maybeSingle();
    
    if (senderIsClinicUser) {
      console.log("Skipping CC'd copy - sender is a clinic user:", senderEmail);
      return NextResponse.json({ 
        ok: true, 
        message: "Skipped CC copy from clinic user",
        reason: "sender_is_clinic_user"
      });
    }
    
    // If no patient found, try to create one from the sender email OR log without patient
    if (!targetPatientId) {
      console.log("No patient found for email from:", from);
      console.log("Attempting to find or create patient record...");
      
      // Try to find existing patient by email one more time
      const { data: existingPatient } = await supabase
        .from("patients")
        .select("id")
        .ilike("email", senderEmail)
        .maybeSingle();
      
      if (existingPatient) {
        targetPatientId = existingPatient.id;
        console.log("Found patient by case-insensitive email match:", targetPatientId);
      } else {
        // Create a new patient from the sender info
        const senderName = from.match(/^([^<]+)/) ? from.match(/^([^<]+)/)?.[1]?.trim() : senderEmail.split("@")[0];
        const nameParts = senderName?.split(" ") || [senderEmail.split("@")[0]];
        
        const { data: newPatient, error: createError } = await supabase
          .from("patients")
          .insert({
            first_name: nameParts[0] || "Unknown",
            last_name: nameParts.slice(1).join(" ") || "",
            email: senderEmail,
            source: "inbound_email",
          })
          .select("id")
          .single();
        
        if (newPatient) {
          targetPatientId = newPatient.id;
          console.log("Created new patient from inbound email:", targetPatientId);
        } else {
          console.error("Failed to create patient:", createError);
          // Still log the email without a patient association
          console.log("Logging email without patient association");
        }
      }
    }
    
    // Log the inbound email in the database
    const { data: insertedEmail, error: insertError } = await supabase
      .from("emails")
      .insert({
        patient_id: targetPatientId || null,
        from_address: senderEmail,
        to_address: to,
        subject: subject,
        body: cleanedBody || rawBody,
        status: "sent", // Use 'sent' for now until 'received' enum value is added
        direction: "inbound",
        sent_at: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    
    if (insertError || !insertedEmail) {
      console.error("Error inserting reply email:", insertError);
      return NextResponse.json({ 
        error: "Failed to log reply",
        details: insertError?.message || "Unknown error"
      }, { status: 500 });
    }
    
    const newEmailId = insertedEmail.id as string;
    
    // Store attachments in Supabase Storage and create records
    let attachmentErrors: string[] = [];
    if (attachments.length > 0) {
      console.log(`Processing ${attachments.length} attachments for email ${newEmailId}`);
      
      for (const att of attachments) {
        try {
          // Create a safe file name and unique path
          const safeName = att.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const ext = att.fileName.split(".").pop() || "bin";
          const storagePath = `inbound/${targetPatientId}/${newEmailId}/${Date.now()}-${safeName}`;
          
          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("email-attachments")
            .upload(storagePath, att.data, {
              contentType: att.contentType,
              upsert: false,
            });
          
          if (uploadError) {
            console.error("Error uploading attachment:", att.fileName, uploadError);
            attachmentErrors.push(`Upload failed for ${att.fileName}: ${uploadError.message}`);
            continue;
          }
          
          // Create record in email_attachments table
          const { error: recordError } = await supabase
            .from("email_attachments")
            .insert({
              email_id: newEmailId,
              file_name: att.fileName,
              storage_path: storagePath,
              mime_type: att.contentType,
              file_size: att.size,
            });
          
          if (recordError) {
            console.error("Error creating attachment record:", att.fileName, recordError);
            attachmentErrors.push(`Record failed for ${att.fileName}: ${recordError.message}`);
          } else {
            console.log("Attachment saved successfully:", att.fileName);
          }
        } catch (attErr) {
          console.error("Unexpected error processing attachment:", att.fileName, attErr);
          attachmentErrors.push(`Error processing ${att.fileName}`);
        }
      }
    }
    
    console.log("Email reply logged successfully for patient:", targetPatientId);
    
    // Create notification for email reply - notify the user who sent the original email
    // BUT only if this is actually from a patient (not a CC'd copy of our own outbound email)
    if (targetEmailId && targetPatientId && senderEmail) {
      try {
        // First, check if the sender is a clinic user - if so, skip notification
        // (This handles CC'd copies of outbound emails that Mailgun routes back to us)
        const { data: senderIsUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", senderEmail.toLowerCase())
          .single();
        
        if (senderIsUser) {
          console.log("Skipping notification - sender is a clinic user:", senderEmail);
        } else {
          // Sender is NOT a clinic user, so this is a real patient reply
          // Get the original email to find who sent it
          const { data: originalEmail } = await supabase
            .from("emails")
            .select("id, from_address, subject")
            .eq("id", targetEmailId)
            .single();
          
          if (originalEmail && originalEmail.from_address) {
            // Find the user who sent the original email (case-insensitive)
            const { data: originalSenderUser } = await supabase
              .from("users")
              .select("id")
              .ilike("email", originalEmail.from_address)
              .maybeSingle();
            
            if (originalSenderUser) {
              // Create email reply notification
              await supabase
                .from("email_reply_notifications")
                .insert({
                  user_id: originalSenderUser.id,
                  patient_id: targetPatientId,
                  original_email_id: targetEmailId,
                  reply_email_id: newEmailId,
                  read_at: null,
                });
              console.log("Email reply notification created for user:", originalSenderUser.id);
            }
          }
        }
      } catch (notifError) {
        console.error("Failed to create email reply notification:", notifError);
        // Don't fail the request for notification errors
      }
    }
    
    return NextResponse.json({ 
      ok: true,
      message: "Reply logged successfully",
      patientId: targetPatientId,
      emailId: newEmailId,
      attachmentsProcessed: attachments.length,
      attachmentErrors: attachmentErrors.length > 0 ? attachmentErrors : undefined,
    });
    
  } catch (error) {
    console.error("Error processing email webhook:", error);
    return NextResponse.json(
      { 
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Also handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ 
    status: "Email webhook endpoint active",
    instructions: "Configure Mailgun to forward incoming emails to this endpoint"
  });
}
