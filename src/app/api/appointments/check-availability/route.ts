import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const doctorName = searchParams.get("doctor"); // Optional: filter by doctor name

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query parameters are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch appointments within the date range
    let query = supabase
      .from("appointments")
      .select("id, start_time, end_time, status, reason")
      .gte("start_time", start)
      .lte("start_time", end)
      .neq("status", "cancelled");

    const { data: appointments, error } = await query;

    if (error) {
      console.error("Error fetching appointments:", error);
      return NextResponse.json(
        { error: "Failed to check availability" },
        { status: 500 }
      );
    }

    // Filter by doctor name if provided (matches [Doctor: Name] in reason field)
    let filteredAppointments = appointments || [];
    if (doctorName) {
      const doctorNameLower = doctorName.toLowerCase().replace("dr. ", "");
      filteredAppointments = filteredAppointments.filter((apt) => {
        if (!apt.reason) return false;
        const match = apt.reason.match(/\[Doctor:\s*(.+?)\s*]/i);
        if (!match) return false;
        return match[1].toLowerCase().includes(doctorNameLower);
      });
    }

    return NextResponse.json({ appointments: filteredAppointments });
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
