import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CRISALIX_API_BASE_URL =
  process.env.CRISALIX_API_BASE_URL ?? "https://api3d-staging.crisalix.com";

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("crisalix_tokens")?.value;

  if (!cookie) {
    return NextResponse.json(
      { error: "Missing Crisalix authentication. Please connect 3D again." },
      { status: 401 },
    );
  }

  let accessToken: string | null = null;
  try {
    const parsed = JSON.parse(cookie) as { access_token?: string | null };
    accessToken = parsed.access_token ?? null;
  } catch {
    accessToken = null;
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Crisalix access token. Please reconnect 3D." },
      { status: 401 },
    );
  }

  const incomingForm = await request.formData();

  const patientId = (incomingForm.get("patient_id") ?? "").toString().trim();
  const reconstructionTypeRaw = (incomingForm.get("reconstruction_type") ?? "")
    .toString()
    .trim()
    .toLowerCase();
  const providerRaw = (incomingForm.get("provider") ?? "4").toString().trim();
  const providerId = providerRaw.replace(/[^0-9]/g, "") || providerRaw;

  // Map our internal reconstruction type to Crisalix values
  let reconstructionType: string;
  if (reconstructionTypeRaw === "breast") {
    reconstructionType = "mammo";
  } else if (reconstructionTypeRaw === "face") {
    reconstructionType = "face";
  } else if (reconstructionTypeRaw === "body") {
    reconstructionType = "body";
  } else {
    return NextResponse.json(
      { error: "Unknown reconstruction type for Crisalix." },
      { status: 400 },
    );
  }

  // Load patient details from Supabase for Crisalix patient[name]/patient[email]
  let patientName = "Patient";
  let patientEmail: string | null = null;

  if (patientId) {
    const { data } = await supabaseAdmin
      .from("patients")
      .select("first_name,last_name,email")
      .eq("id", patientId)
      .single();

    if (data) {
      const fullName = `${data.first_name ?? ""} ${data.last_name ?? ""}`
        .trim()
        .replace(/\s+/g, " ");
      patientName = fullName || data.email || patientName;
      patientEmail = (data.email ?? null) as string | null;
    }
  }

  const outboundForm = new FormData();

  // Patient core fields
  outboundForm.append("patient[name]", patientName);
  if (patientEmail) {
    outboundForm.append("patient[email]", patientEmail);
  }

  // Reconstruction core fields
  outboundForm.append("reconstruction[type]", reconstructionType);
  outboundForm.append("reconstruction[provider]", providerId);

  // Image files
  const leftFile = incomingForm.get("left_profile") as File | null;
  const frontFile = incomingForm.get("front_profile") as File | null;
  const rightFile = incomingForm.get("right_profile") as File | null;
  const backFile = incomingForm.get("back_profile") as File | null;

  if (leftFile) outboundForm.append("reconstruction[left]", leftFile);
  if (frontFile) outboundForm.append("reconstruction[front]", frontFile);
  if (rightFile) outboundForm.append("reconstruction[right]", rightFile);
  if (backFile) outboundForm.append("reconstruction[back]", backFile);

  // Measurements
  if (reconstructionTypeRaw === "breast") {
    const nippleToNipple = (incomingForm.get("nipple_to_nipple_cm") ?? "")
      .toString()
      .trim();
    if (nippleToNipple) {
      outboundForm.append("reconstruction[nipple_to_nipple]", nippleToNipple);
    }
  } else if (reconstructionTypeRaw === "face") {
    const pupilDistance = (incomingForm.get("pupillary_distance_cm") ?? "")
      .toString()
      .trim();
    if (pupilDistance) {
      // Crisalix examples use eye_distance for similar measurements
      outboundForm.append("reconstruction[eye_distance]", pupilDistance);
    }
  } else if (reconstructionTypeRaw === "body") {
    const hipline = (incomingForm.get("hipline_cm") ?? "")
      .toString()
      .trim();
    if (hipline) {
      outboundForm.append("reconstruction[hipline]", hipline);
    }
  }

  const url = `${CRISALIX_API_BASE_URL}/patients`;

  const crisalixResponse = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: outboundForm,
  });

  if (!crisalixResponse.ok) {
    let body: unknown = null;
    try {
      body = await crisalixResponse.json();
    } catch {
      body = await crisalixResponse.text().catch(() => null);
    }

    return NextResponse.json(
      {
        error: "Crisalix patient creation failed",
        status: crisalixResponse.status,
        details: body,
      },
      { status: 502 },
    );
  }

  const data = (await crisalixResponse.json()) as {
    patient?: { id?: number | null; player_id?: string | null };
  };

  if (patientId && data.patient && data.patient.id != null) {
    const typeForDb = reconstructionTypeRaw;
    try {
      await supabaseAdmin.from("crisalix_reconstructions").insert({
        patient_id: patientId,
        crisalix_patient_id: data.patient.id,
        reconstruction_type: typeForDb,
        player_id: data.patient.player_id ?? null,
      });
    } catch {
    }
  }

  return NextResponse.json(data);
}
