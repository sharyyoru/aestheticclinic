import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BOOKING_URL = "https://aestheticclinic.vercel.app/book-appointment";

// Retell agent IDs. Used to detect the call language so the French agent
// sends French SMS/WhatsApp content (the webhook itself is agent-agnostic).
const FRENCH_AGENT_ID = "agent_16738cdb79c26e811fc1cffcc6";

// Twilio WhatsApp booking-link templates. The French agent uses a French
// template if one has been approved and configured via env; otherwise it
// falls back to the English template so the function still works today.
const WHATSAPP_TEMPLATE_EN = "HXdff188b222fe82c18233b2422dd04792";
const WHATSAPP_TEMPLATE_FR = process.env.RETELL_WHATSAPP_TEMPLATE_FR || WHATSAPP_TEMPLATE_EN;

// Helper to log Retell requests to database
async function logRetellRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  response: { body: unknown; status: number } | null,
  startTime: number,
  error?: string
) {
  try {
    const dynamicVars = body.retell_llm_dynamic_variables || 
                        body.call?.retell_llm_dynamic_variables;
    const patientId = dynamicVars?.patient_id || 
                      body.metadata?.patient_id;
    
    await supabaseAdmin.from("retell_request_logs").insert({
      call_id: body.call_id as string || (body.call as Record<string, unknown>)?.call_id as string,
      event_type: body.event as string || "function_call",
      function_name: body.function_name as string || body.name as string,
      request_body: body,
      args: body.arguments || body.args,
      metadata: body.metadata,
      dynamic_variables: dynamicVars,
      call_data: body.call,
      response_body: response?.body,
      response_status: response?.status,
      processing_time_ms: Date.now() - startTime,
      error_message: error,
      patient_id: patientId && typeof patientId === 'string' ? patientId : null,
    });
  } catch (logError) {
    console.error("[Retell Webhook] Failed to log request:", logError);
  }
}

/**
 * POST /api/retell/webhook
 * 
 * Webhook endpoint for Retell AI to trigger actions during calls
 * Supports: send_sms, end_call, transfer_call, etc.
 * 
 * Retell calls this endpoint when the AI agent uses a custom function
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let requestBody: Record<string, unknown> = {};
  
  try {
    requestBody = await request.json();
    
    console.log("[Retell Webhook] Received:", JSON.stringify(requestBody, null, 2));
    
    // Log request to database (fire and forget - don't await)
    logRetellRequest(requestBody, null, startTime).catch(() => {});
    
    // Alias for easier access
    const body = requestBody;

    // Retell sends different payload structures depending on the event type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    } = body as Record<string, any>;
    
    // Type aliases for cleaner code
    const meta = (metadata || {}) as Record<string, unknown>;
    const funcArguments = (funcArgs || {}) as Record<string, unknown>;
    const dynVars = (retell_llm_dynamic_variables || call?.retell_llm_dynamic_variables || {}) as Record<string, unknown>;
    const callData = (call || {}) as Record<string, unknown>;

    // Handle different event types
    if (event === "call_started") {
      console.log(`[Retell Webhook] Call started: ${call_id}`);
      return NextResponse.json({ success: true, event: "call_started" });
    }

    if (event === "call_ended") {
      console.log(`[Retell Webhook] Call ended: ${call_id}`);
      
      // Log call completion to database
      if (meta.patient_id) {
        try {
          await supabaseAdmin.from("activity_log").insert({
            patient_id: meta.patient_id as string,
            activity_type: "ai_call_completed",
            description: `AI outbound call completed`,
            metadata: {
              call_id,
              duration: callData.duration_seconds,
              agent_language: meta.agent_language,
              deal_id: meta.deal_id,
            },
          });
        } catch (logError) {
          console.warn("[Retell Webhook] Failed to log call completion:", logError);
        }
      }
      
      return NextResponse.json({ success: true, event: "call_ended" });
    }

    // Handle custom function calls from the AI agent
    // Detect function from args if "Payload: args only" is enabled in Retell
    let detectedFunction = function_name || (body as Record<string, unknown>).name;
    const args = (funcArgs || (body as Record<string, unknown>).args || body) as Record<string, unknown>;

    // Auto-detect function based on arguments if function_name not provided or is "test_tool"
    if (!detectedFunction || detectedFunction === "test_tool") {
      // Check args first, then body for the parameters
      const checkArgs = args || body;
      if (checkArgs.action && checkArgs.location) {
        detectedFunction = "check_availability";
      } else if (checkArgs.service_name && checkArgs.doctor_name && checkArgs.date_time_iso) {
        detectedFunction = "book_appointment";
      } else if (checkArgs.message_type !== undefined) {
        detectedFunction = "send_whatsapp";
      } else if (checkArgs.phone_number && !checkArgs.reason && !checkArgs.from_number) {
        // If only phone_number is provided (no callback/dropped call fields), assume WhatsApp
        detectedFunction = "send_whatsapp";
      }
    }

    if (event === "function_call" || detectedFunction) {
      const funcName = detectedFunction;

      console.log(`[Retell Webhook] Function call: ${funcName}`, args);

      // Detect the call language so French calls send French messaging.
      // Priority: explicit `language` arg from the agent (most reliable for the
      // language-switcher agent), then call metadata, then the agent ID.
      const callAgentId = (call?.agent_id || (body as Record<string, unknown>).agent_id) as
        | string
        | undefined;
      const argLanguage =
        typeof args.language === "string" ? args.language.toLowerCase() : "";
      const isFrench =
        argLanguage.startsWith("fr") ||
        metadata?.agent_language === "french" ||
        callAgentId === FRENCH_AGENT_ID;

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
            result: isFrench
              ? "Je suis désolée, je n'ai pas pu envoyer le SMS car je n'ai pas votre numéro de téléphone."
              : "I apologize, but I couldn't send the SMS because I don't have your phone number.",
          });
        }

        // Build the SMS message based on type
        let smsBody = "";
        const patientName = retell_llm_dynamic_variables?.user_name || metadata?.patient_name || (isFrench ? "" : "there");
        const greetingName = patientName ? ` ${patientName}` : "";
        
        if (message_type === "booking_link" || !message_type) {
          smsBody = isFrench
            ? `Bonjour${greetingName} ! Voici votre lien de réservation pour la Clinique Esthétique : ${BOOKING_URL}\n\nVotre première consultation est offerte. Au plaisir de vous voir !`
            : `Hi${greetingName || " there"}! Here's your booking link for Aesthetics Clinic: ${BOOKING_URL}\n\nYour first consultation is complimentary. We look forward to seeing you!`;
        } else if (message_type === "contact_info") {
          smsBody = isFrench
            ? `Coordonnées de la Clinique Esthétique :\n📞 +41 22 732 22 23\n📧 info@aesthetics-ge.ch\n📍 Rue du Rhône 17, 1204 Genève`
            : `Aesthetics Clinic Contact:\n📞 +41 22 732 22 23\n📧 info@aesthetics-ge.ch\n📍 Rue du Rhône 17, 1204 Geneva`;
        } else if (message_type === "custom" && args.custom_message) {
          smsBody = String(args.custom_message);
        } else {
          smsBody = isFrench
            ? `Bonjour${greetingName} ! Merci de votre intérêt pour la Clinique Esthétique. Réservez votre consultation offerte : ${BOOKING_URL}`
            : `Hi${greetingName || " there"}! Thank you for your interest in Aesthetics Clinic. Book your complimentary consultation: ${BOOKING_URL}`;
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
              result: isFrench
                ? "SMS envoyé avec succès. Le patient devrait recevoir le lien de réservation sous peu."
                : "SMS sent successfully. The patient should receive the booking link shortly.",
            });
          } else {
            const errorData = await smsResponse.json().catch(() => ({}));
            console.error("[Retell Webhook] SMS send failed:", errorData);
            return NextResponse.json({
              success: false,
              error: "Failed to send SMS",
              result: isFrench
                ? "Je suis désolée, il y a eu un problème lors de l'envoi du SMS. Veuillez réessayer ou contacter la clinique au 022 732 22 23."
                : "I apologize, but there was an issue sending the SMS. Please try again or contact the clinic directly at 022 732 22 23.",
            });
          }
        } catch (smsError) {
          console.error("[Retell Webhook] SMS error:", smsError);
          return NextResponse.json({
            success: false,
            error: smsError instanceof Error ? smsError.message : "SMS error",
            result: isFrench
              ? "Je suis désolée, je n'ai pas pu envoyer le SMS pour le moment. Veuillez contacter la clinique au 022 732 22 23."
              : "I apologize, but I couldn't send the SMS right now. Please contact the clinic directly at 022 732 22 23.",
          });
        }
      }

      // ── Handle send_whatsapp function - Send WhatsApp message via Twilio template
      if (funcName === "send_whatsapp") {
        const { phone_number, message_type } = args;
        
        // Get phone from args or from call metadata
        const toPhone = phone_number || metadata?.patient_phone || call?.to_number;
        const patientName = retell_llm_dynamic_variables?.first_name || 
                           metadata?.patient_first_name || 
                           metadata?.patient_name?.split(" ")[0] || 
                           (isFrench ? "" : "there");
        
        if (!toPhone) {
          console.error("[Retell Webhook] No phone number for WhatsApp");
          return NextResponse.json({
            success: false,
            error: "No phone number provided for WhatsApp",
            result: isFrench
              ? "Je suis désolée, je n'ai pas pu envoyer le message WhatsApp car je n'ai pas votre numéro de téléphone."
              : "I apologize, but I couldn't send the WhatsApp message because I don't have your phone number.",
          });
        }

        // Template SID for the booking-link message (French agent uses the
        // French template when configured, otherwise falls back to English).
        const templateSid = isFrench ? WHATSAPP_TEMPLATE_FR : WHATSAPP_TEMPLATE_EN;
        const templateName = patientName || (isFrench ? "" : "there");

        try {
          const whatsappResponse = await fetch(new URL("/api/whatsapp/send", request.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: toPhone,
              templateSid: templateSid,
              templateVariables: {
                "1": templateName, // Variable for patient name in template
              },
              patientId: metadata?.patient_id,
            }),
          });

          if (whatsappResponse.ok) {
            console.log(`[Retell Webhook] WhatsApp sent to ${toPhone}`);
            
            // Log WhatsApp to activity AND whatsapp_queue for patient history
            if (metadata?.patient_id) {
              try {
                // Log to activity_log
                await supabaseAdmin.from("activity_log").insert({
                  patient_id: metadata.patient_id,
                  activity_type: "whatsapp_sent",
                  description: `WhatsApp sent during AI call: ${message_type || "booking_link"}`,
                  metadata: {
                    call_id,
                    phone: toPhone,
                    message_type: message_type || "booking_link",
                    template_sid: templateSid,
                  },
                });

                // Also log to whatsapp_queue so it appears in patient's sent messages
                await supabaseAdmin.from("whatsapp_queue").insert({
                  to_phone: toPhone,
                  message_body: isFrench
                    ? `📅 Lien de réservation envoyé via appel IA (Modèle : booking_link)\n\nBonjour ${patientName}, voici votre lien de réservation pour la Clinique Esthétique.`
                    : `📅 Booking link sent via AI call (Template: booking_link)\n\nHi ${patientName}, here's your booking link for Aesthetics Clinic.`,
                  patient_id: metadata.patient_id,
                  status: "sent",
                  sent_at: new Date().toISOString(),
                });
              } catch (logError) {
                console.warn("[Retell Webhook] Failed to log WhatsApp:", logError);
              }
            }

            return NextResponse.json({
              success: true,
              result: isFrench
                ? "Message WhatsApp envoyé avec succès. Le patient devrait recevoir le lien de réservation sur WhatsApp sous peu."
                : "WhatsApp message sent successfully. The patient should receive the booking link on WhatsApp shortly.",
            });
          } else {
            const errorData = await whatsappResponse.json().catch(() => ({}));
            console.error("[Retell Webhook] WhatsApp send failed:", errorData);
            return NextResponse.json({
              success: false,
              error: "Failed to send WhatsApp",
              result: isFrench
                ? "Je suis désolée, il y a eu un problème lors de l'envoi du message WhatsApp. Souhaitez-vous que j'essaie par SMS, ou vous pouvez réserver en ligne sur aestheticclinic.vercel.app."
                : "I apologize, but there was an issue sending the WhatsApp message. Would you like me to try SMS instead, or you can visit aestheticclinic.vercel.app to book online.",
            });
          }
        } catch (whatsappError) {
          console.error("[Retell Webhook] WhatsApp error:", whatsappError);
          return NextResponse.json({
            success: false,
            error: whatsappError instanceof Error ? whatsappError.message : "WhatsApp error",
            result: isFrench
              ? "Je suis désolée, je n'ai pas pu envoyer le message WhatsApp pour le moment. Vous pouvez réserver en ligne sur aestheticclinic.vercel.app."
              : "I apologize, but I couldn't send the WhatsApp message right now. You can book online at aestheticclinic.vercel.app.",
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

      // ── Handle check_availability function - proxies to check-availability endpoint
      if (funcName === "check_availability") {
        console.log(`[Retell Webhook] Check availability:`, args);
        
        try {
          const checkResponse = await fetch(new URL("/api/retell/check-availability", request.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(args),
          });

          const checkData = await checkResponse.json();
          console.log(`[Retell Webhook] Availability result:`, checkData);

          if (checkResponse.ok && checkData.success) {
            return NextResponse.json({
              success: true,
              ...checkData,
              result: checkData.instruction || "Availability checked successfully.",
            });
          } else {
            return NextResponse.json({
              success: false,
              error: checkData.error || "Failed to check availability",
              result: checkData.error || "I'm having trouble checking availability right now. Would you like me to take your details and have someone call you back?",
            });
          }
        } catch (checkError) {
          console.error("[Retell Webhook] Check availability error:", checkError);
          return NextResponse.json({
            success: false,
            error: checkError instanceof Error ? checkError.message : "Error",
            result: "I'm having trouble accessing the booking system. Would you like me to take your details instead?",
          });
        }
      }

      // ── Handle book_appointment function - creates the actual booking
      if (funcName === "book_appointment") {
        console.log(`[Retell Webhook] Book appointment:`, args);
        
        // Check multiple sources for dynamic variables
        // Retell may send them in different places depending on call type
        const dynamicVars = retell_llm_dynamic_variables || 
                           call?.retell_llm_dynamic_variables ||
                           body.retell_llm_dynamic_variables ||
                           {};
        
        console.log(`[Retell Webhook] Dynamic variables:`, JSON.stringify(dynamicVars));
        console.log(`[Retell Webhook] Metadata:`, JSON.stringify(metadata));
        console.log(`[Retell Webhook] Call object:`, JSON.stringify(call));
        
        // Get patient_id from multiple sources
        const patientId = dynamicVars.patient_id || 
                          metadata?.patient_id ||
                          args.patient_id ||
                          null;
        
        // Get patient details from args, dynamic variables, or metadata
        const patientFirstName = args.first_name || 
                                  dynamicVars.first_name || 
                                  metadata?.patient_first_name || "";
        const patientLastName = args.last_name || 
                                 dynamicVars.last_name || 
                                 metadata?.patient_last_name || "";
        const patientEmail = args.email || 
                              dynamicVars.email || 
                              metadata?.patient_email || "";
        const patientPhone = args.phone || 
                              dynamicVars.phone || 
                              metadata?.patient_phone || 
                              call?.to_number || "";

        console.log(`[Retell Webhook] Resolved patient_id: ${patientId}`);

        // Build booking request
        const bookingPayload = {
          call_id: call_id || "webhook-" + Date.now(),
          agent_id: call?.agent_id || "webhook",
          patient_id: patientId, // Pass patient_id to use existing patient
          patient: {
            first_name: patientFirstName,
            last_name: patientLastName,
            email: patientEmail,
            phone: patientPhone,
          },
          appointment: {
            service_name: args.service_name,
            doctor_name: args.doctor_name,
            date_time_iso: args.date_time_iso,
            location: args.location,
            notes: args.notes || `Booked via AI call`,
          },
        };

        console.log(`[Retell Webhook] Booking payload:`, bookingPayload);

        try {
          const bookResponse = await fetch(new URL("/api/retell/book-appointment", request.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookingPayload),
          });

          const bookData = await bookResponse.json();
          console.log(`[Retell Webhook] Booking result:`, bookData);

          if (bookResponse.ok && bookData.success) {
            const booking = bookData.booking;
            return NextResponse.json({
              success: true,
              booking,
              result: `Appointment booked successfully for ${booking.date} at ${booking.time} with ${booking.doctor}. ${patientEmail ? "A confirmation email has been sent." : ""}`,
            });
          } else if (bookData.code === "SLOT_UNAVAILABLE") {
            return NextResponse.json({
              success: false,
              error: "slot_unavailable",
              result: "I apologize, but that time slot is no longer available. Let me find another option for you.",
            });
          } else {
            return NextResponse.json({
              success: false,
              error: bookData.error || "Booking failed",
              result: bookData.error || "I'm having trouble completing the booking. Would you like me to take your details and have someone call you back to confirm?",
            });
          }
        } catch (bookError) {
          console.error("[Retell Webhook] Booking error:", bookError);
          return NextResponse.json({
            success: false,
            error: bookError instanceof Error ? bookError.message : "Error",
            result: "I apologize, but there was an issue with the booking system. Would you like me to take your details and have someone call you back?",
          });
        }
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
      "check_availability - Check appointment availability (action: get_services, get_locations, get_slots, get_next_available)",
      "book_appointment - Book an appointment directly (requires service_name, doctor_name, date_time_iso, location)",
      "send_whatsapp - Send booking link via WhatsApp template (HXdff188b222fe82c18233b2422dd04792)",
      "send_sms - Send booking link or contact info via SMS",
      "end_call - Properly end the call",
      "transfer_call - Transfer to another department",
    ],
    booking_url: BOOKING_URL,
    note: "For outbound calls, patient details (name, email, phone) are passed via metadata from trigger-retell-call",
  });
}
