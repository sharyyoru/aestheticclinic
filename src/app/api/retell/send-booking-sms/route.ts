import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export const runtime = "nodejs";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER ?? "";
const BOOKING_URL = "https://aestheticclinic.vercel.app/book-appointment/location";

const SMS_MESSAGES = {
  en: `✨ Aesthetics Clinic Geneva

Book your complimentary consultation here:
${BOOKING_URL}

We offer 36-month payment plans on all treatments.

Questions? Call us: +41 22 732 22 23`,

  fr: `✨ Clinique Esthétique Genève

Réservez votre consultation offerte ici:
${BOOKING_URL}

Nous proposons des plans de paiement sur 36 mois.

Questions? Appelez-nous: +41 22 732 22 23`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Retell sends the function arguments in the request
    const { args } = body;
    const phoneNumber = args?.phone_number || body.phone_number;
    const language = args?.language || body.language || "en";

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("Twilio credentials not configured");
      return NextResponse.json(
        { success: false, error: "SMS service not configured" },
        { status: 500 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.startsWith("+") 
      ? phoneNumber 
      : `+${phoneNumber.replace(/\D/g, "")}`;

    // Send SMS via Twilio
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    
    const message = await client.messages.create({
      body: SMS_MESSAGES[language as keyof typeof SMS_MESSAGES] || SMS_MESSAGES.en,
      from: TWILIO_PHONE_NUMBER,
      to: normalizedPhone,
    });

    console.log("SMS sent successfully:", message.sid);

    // Return response that Retell expects
    return NextResponse.json({
      success: true,
      message_sid: message.sid,
      // This is what the agent will "hear" as the function result
      result: language === "fr" 
        ? "Le lien de réservation a été envoyé par SMS avec succès."
        : "The booking link has been sent via SMS successfully.",
    });

  } catch (error) {
    console.error("Error sending SMS:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to send SMS",
        result: "I apologize, there was an issue sending the SMS. Please visit our website directly."
      },
      { status: 500 }
    );
  }
}
