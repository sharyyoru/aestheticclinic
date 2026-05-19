import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        cookie: cookieStore.toString(),
      },
    },
  });
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const type = url.searchParams.get("type"); // chat, web_call, phone_call
  const status = url.searchParams.get("status"); // active, completed, ended
  const patientLinked = url.searchParams.get("patient_linked"); // true, false
  const search = url.searchParams.get("search");

  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("chat_conversations")
    .select(`
      *,
      patient:patients(id, first_name, last_name, email, mobile, avatar_url)
    `, { count: "exact" })
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq("conversation_type", type);
  }
  
  if (status) {
    query = query.eq("status", status);
  }

  if (patientLinked === "true") {
    query = query.not("patient_id", "is", null);
  } else if (patientLinked === "false") {
    query = query.is("patient_id", null);
  }

  if (search) {
    query = query.or(`visitor_email.ilike.%${search}%,visitor_phone.ilike.%${search}%,visitor_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching chat logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    conversations: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

// Link conversation to patient
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { conversationId, patientId, action } = body;

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  // Create new patient from conversation
  if (action === "create_patient") {
    const { data: conv } = await supabaseAdmin
      .from("chat_conversations")
      .select("visitor_email, visitor_phone, visitor_name")
      .eq("id", conversationId)
      .single();

    if (!conv?.visitor_email && !conv?.visitor_phone) {
      return NextResponse.json({ error: "No contact info to create patient" }, { status: 400 });
    }

    // Parse name if available
    const nameParts = (conv.visitor_name || "").trim().split(" ");
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "";

    const { data: newPatient, error: createError } = await supabaseAdmin
      .from("patients")
      .insert({
        first_name: firstName,
        last_name: lastName || null,
        email: conv.visitor_email || null,
        mobile: conv.visitor_phone || null,
        source: "aliice_chat",
        status: "lead",
      })
      .select("id")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Link to conversation
    await supabaseAdmin
      .from("chat_conversations")
      .update({ patient_id: newPatient.id, patient_match_type: "created" })
      .eq("id", conversationId);

    return NextResponse.json({ success: true, patientId: newPatient.id });
  }

  // Link to existing patient
  if (action === "link_patient" && patientId) {
    const { error } = await supabaseAdmin
      .from("chat_conversations")
      .update({ patient_id: patientId, patient_match_type: "manual" })
      .eq("id", conversationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Update conversation status
  if (action === "end_conversation") {
    const { error } = await supabaseAdmin
      .from("chat_conversations")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", conversationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
