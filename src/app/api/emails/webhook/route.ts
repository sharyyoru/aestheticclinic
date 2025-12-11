import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractReplyContent } from "@/utils/emailCleaner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    // Parse the incoming webhook data from Mailgun
    const formData = await request.formData();
    
    const from = formData.get("from")?.toString() || "";
    const to = formData.get("To")?.toString() || "";
    const subject = formData.get("Subject")?.toString() || "";
    const bodyPlain = formData.get("body-plain")?.toString() || "";
    const bodyHtml = formData.get("body-html")?.toString() || "";
    const timestamp = formData.get("timestamp")?.toString() || "";
    const inReplyTo = formData.get("In-Reply-To")?.toString() || "";
    const references = formData.get("References")?.toString() || "";
    
    // Get custom variables we set when sending
    const emailId = formData.get("email-id")?.toString() || "";
    const patientId = formData.get("patient-id")?.toString() || "";
    
    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let targetPatientId = patientId;
    let originalSubject = subject;
    
    // Try to find the original email using multiple methods
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
      
      // Method 3: Try to find by matching recipient email (the "from" in the reply is the patient)
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
    
    if (!targetPatientId) {
      console.log("Could not determine patient for email from:", from);
      return NextResponse.json({ 
        message: "Patient not found for reply",
        received: true 
      });
    }
    
    // Clean the email body to remove signatures and quoted text
    const rawBody = bodyHtml || bodyPlain;
    const isHtml = !!bodyHtml;
    const cleanedBody = extractReplyContent(rawBody, isHtml);
    
    // Extract sender email
    const emailMatch = from.match(/<([^>]+)>/) || [null, from];
    const senderEmail = emailMatch[1]?.trim() || from.trim();
    
    // Log the reply as an inbound email in the database
    const { error: insertError } = await supabase
      .from("emails")
      .insert({
        patient_id: targetPatientId,
        from_address: senderEmail,
        to_address: to,
        subject: subject,
        body: cleanedBody || rawBody,
        status: "received",
        direction: "inbound",
        sent_at: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    
    if (insertError) {
      console.error("Error inserting reply email:", insertError);
      return NextResponse.json({ 
        error: "Failed to log reply",
        details: insertError.message 
      }, { status: 500 });
    }
    
    console.log("Email reply logged successfully for patient:", targetPatientId);
    
    return NextResponse.json({ 
      ok: true,
      message: "Reply logged successfully",
      patientId: targetPatientId
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
