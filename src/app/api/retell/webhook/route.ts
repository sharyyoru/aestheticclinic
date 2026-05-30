import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BOOKING_URL = "https://aestheticclinic.vercel.app/book-appointment";

/**
 * POST /api/retell/webhook
 * 
 * Webhook endpoint for Retell AI to trigger actions during calls
 * Supports: send_sms, end_call, transfer_call, etc.
 * 
 * Retell calls this endpoint when the AI agent uses a custom function
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("[Retell Webhook] Received:", JSON.stringify(body, null, 2));

    // Retell sends different payload structures depending on the event type
    const { 
      event,
      call,
      call_id,
      // For function calls
      function_name,
      arguments: funcArgs,
      // Metadata passed when creating the call
      metadata,
      // Dynamic variables from the call
      retell_llm_dynamic_variables,
    } = body;

    // Handle different event types
    if (event === "call_started") {
      console.log(`[Retell Webhook] Call started: ${call_id}`);
      return NextResponse.json({ success: true, event: "call_started" });
    }

    if (event === "call_ended") {
      console.log(`[Retell Webhook] Call ended: ${call_id}`);
      
      // Log call completion to database
      if (metadata?.patient_id) {
        try {
          await supabaseAdmin.from("activity_log").insert({
            patient_id: metadata.patient_id,
            activity_type: "ai_call_completed",
            description: `AI outbound call completed`,
            metadata: {
              call_id,
              duration: call?.duration_seconds,
              agent_language: metadata.agent_language,
              deal_id: metadata.deal_id,
            },
          });
        } catch (logError) {
          console.warn("[Retell Webhook] Failed to log call completion:", logError);
        }
      }
      
      return NextResponse.json({ success: true, event: "call_ended" });
    }

    // Handle custom function calls from the AI agent
    if (event === "function_call" || function_name) {
      const funcName = function_name || body.name;
      const args = funcArgs || body.args || {};

      console.log(`[Retell Webhook] Function call: ${funcName}`, args);

      // ── Handle send_sms function
      if (funcName === "send_sms") {
        const { phone_number, message_type } = args;
        
        // Get phone from args or from call metadata
        const toPhone = phone_number || metadata?.patient_phone || call?.to_number;
        
        if (!toPhone) {
          console.error("[Retell Webhook] No phone number for SMS");
          return NextResponse.json({
            success: false,
            error: "No phone number provided for SMS",
            result: "I apologize, but I couldn't send the SMS because I don't have your phone number.",
          });
        }

        // Build the SMS message based on type
        let smsBody = "";
        const patientName = retell_llm_dynamic_variables?.user_name || metadata?.patient_name || "there";
        
        if (message_type === "booking_link" || !message_type) {
          smsBody = `Hi ${patientName}! Here's your booking link for Aesthetics Clinic: ${BOOKING_URL}\n\nYour first consultation is complimentary. We look forward to seeing you!`;
        } else if (message_type === "contact_info") {
          smsBody = `Aesthetics Clinic Contact:\n📞 +41 22 732 22 23\n📧 info@aesthetics-ge.ch\n📍 Rue du Rhône 17, 1204 Geneva`;
        } else if (message_type === "custom" && args.custom_message) {
          smsBody = args.custom_message;
        } else {
          smsBody = `Hi ${patientName}! Thank you for your interest in Aesthetics Clinic. Book your complimentary consultation: ${BOOKING_URL}`;
        }

        // Send SMS via our SMS endpoint
        try {
          const smsResponse = await fetch(new URL("/api/sms/send", request.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: toPhone,
              body: smsBody,
              patientId: metadata?.patient_id,
              metadata: {
                source: "retell_ai",
                call_id,
                message_type: message_type || "booking_link",
              },
            }),
          });

          if (smsResponse.ok) {
            console.log(`[Retell Webhook] SMS sent to ${toPhone}`);
            
            // Log SMS to activity
            if (metadata?.patient_id) {
              try {
                await supabaseAdmin.from("activity_log").insert({
                  patient_id: metadata.patient_id,
                  activity_type: "sms_sent",
                  description: `SMS sent during AI call: ${message_type || "booking_link"}`,
                  metadata: {
                    call_id,
                    phone: toPhone,
                    message_type: message_type || "booking_link",
                  },
                });
              } catch (logError) {
                console.warn("[Retell Webhook] Failed to log SMS:", logError);
              }
            }

            return NextResponse.json({
              success: true,
              result: "SMS sent successfully. The patient should receive the booking link shortly.",
            });
          } else {
            const errorData = await smsResponse.json().catch(() => ({}));
            console.error("[Retell Webhook] SMS send failed:", errorData);
            return NextResponse.json({
              success: false,
              error: "Failed to send SMS",
              result: "I apologize, but there was an issue sending the SMS. Please try again or contact the clinic directly at 022 732 22 23.",
            });
          }
        } catch (smsError) {
          console.error("[Retell Webhook] SMS error:", smsError);
          return NextResponse.json({
            success: false,
            error: smsError instanceof Error ? smsError.message : "SMS error",
            result: "I apologize, but I couldn't send the SMS right now. Please contact the clinic directly at 022 732 22 23.",
          });
        }
      }

      // ── Handle end_call function
      if (funcName === "end_call") {
        console.log(`[Retell Webhook] End call requested for ${call_id}`);
        return NextResponse.json({
          success: true,
          result: "Call ending. Thank you for your time, goodbye!",
          action: "end_call",
        });
      }

      // ── Handle transfer_call function (for future use)
      if (funcName === "transfer_call") {
        const { department, reason } = args;
        console.log(`[Retell Webhook] Transfer requested to ${department}: ${reason}`);
        
        // For now, just acknowledge - would need to implement actual transfer
        return NextResponse.json({
          success: true,
          result: `I'll transfer you to our ${department || "team"} now. Please hold.`,
          action: "transfer",
          transfer_to: department,
        });
      }

      // Unknown function
      console.warn(`[Retell Webhook] Unknown function: ${funcName}`);
      return NextResponse.json({
        success: false,
        error: `Unknown function: ${funcName}`,
        result: "I'm sorry, I encountered an issue. Let me help you in another way.",
      });
    }

    // Default response for unhandled events
    return NextResponse.json({ success: true, message: "Event received" });

  } catch (error) {
    console.error("[Retell Webhook] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        result: "I apologize, there was a technical issue. Please contact the clinic directly.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/retell/webhook
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Retell AI Webhook",
    supported_functions: [
      "send_sms - Send booking link or contact info via SMS",
      "end_call - Properly end the call",
      "transfer_call - Transfer to another department",
    ],
    booking_url: BOOKING_URL,
  });
}
