import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyOtp, createSessionToken } from "@/lib/patientAppAuth";

export async function POST(request: Request) {
  try {
    const { email, code } = (await request.json()) as { email?: string; code?: string };
    const normalized = (email || "").trim().toLowerCase();

    if (!normalized || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    if (!verifyOtp(normalized, code)) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email, avatar_url")
      .ilike("email", normalized)
      .limit(1)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json({ error: "No patient account found for this email" }, { status: 404 });
    }

    const token = createSessionToken(patient.id, normalized);

    return NextResponse.json({
      token,
      patient: {
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        avatar_url: patient.avatar_url,
      },
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
