import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const messageId = formData.get("Message-Id")?.toString() || "";
    
    // Extract patient email from the 'to' field (reply address)
    // Format: reply+<emailId>@domain.com
    const replyMatch = to.match(/reply\+([a-f0-9\-]+)@/);
    
    if (!replyMatch) {
      console.log("No reply email ID found in recipient:", to);
      return NextResponse.json({ 
        message: "Not a reply email",
        received: true 
      });
    }
    
    const originalEmailId = replyMatch[1];
    
    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Find the original email to get patient_id
    const { data: originalEmail, error: fetchError } = await supabase
      .from("emails")
      .select("patient_id, to_address, subject")
      .eq("id", originalEmailId)
      .single();
    
    if (fetchError || !originalEmail) {
      console.error("Original email not found:", originalEmailId, fetchError);
      return NextResponse.json({ 
        error: "Original email not found",
        received: true 
      }, { status: 404 });
    }
    
    // Log the reply as an inbound email in the database
    const { error: insertError } = await supabase
      .from("emails")
      .insert({
        patient_id: originalEmail.patient_id,
        from_address: from,
        to_address: originalEmail.to_address, // The patient who replied
        subject: subject,
        body: bodyHtml || bodyPlain,
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
    
    console.log("Email reply logged successfully for patient:", originalEmail.patient_id);
    
    return NextResponse.json({ 
      ok: true,
      message: "Reply logged successfully",
      patientId: originalEmail.patient_id
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
