import { NextRequest, NextResponse } from "next/server";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const BOOKING_URL = process.env.BOOKING_URL || "https://aesthetics-clinic.com/book";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Retell sends the function arguments in the 'args' field
    const args = body.args || body;
    const { phone_number, caller_name } = args;

    if (!phone_number) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Format the phone number for WhatsApp
    let formattedNumber = phone_number.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    if (!formattedNumber.startsWith("+")) {
      formattedNumber = "+" + formattedNumber;
    }
    const whatsappTo = `whatsapp:${formattedNumber}`;

    // Compose the message
    const greeting = caller_name ? `Hello ${caller_name.split(" ")[0]}` : "Hello";
    const messageBody = `${greeting}, thank you for your interest in Aesthetics Clinic! 🏥\n\nHere is your personal link to book an appointment online:\n${BOOKING_URL}\n\nWe look forward to seeing you soon!\n\n- Aesthetics Clinic Team`;

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    const formData = new URLSearchParams();
    formData.append("To", whatsappTo);
    formData.append("From", TWILIO_WHATSAPP_FROM);
    formData.append("Body", messageBody);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio WhatsApp error:", twilioResult);
      return NextResponse.json({
        success: false,
        error: twilioResult.message || "Failed to send WhatsApp message",
      });
    }

    console.log(`Booking link sent via WhatsApp to ${formattedNumber} for ${caller_name}`);

    // Return success response for Retell
    return NextResponse.json({
      success: true,
      message: `Booking link sent successfully to ${formattedNumber}`,
      message_sid: twilioResult.sid,
    });

  } catch (error) {
    console.error("Error sending WhatsApp booking link:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
