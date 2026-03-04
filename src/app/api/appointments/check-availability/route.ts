import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Doctor-specific capacity: XT and CR can have 3 concurrent, others have 1
const MULTI_CAPACITY_DOCTORS = ["xavier-tenorio", "cesar-rodriguez"];

function getMaxCapacity(doctorSlug: string | null): number {
  if (!doctorSlug) return 1;
  return MULTI_CAPACITY_DOCTORS.includes(doctorSlug) ? 3 : 1;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const doctorName = searchParams.get("doctor"); // Optional: filter by doctor name
  const doctorSlug = searchParams.get("slug"); // Optional: doctor slug for capacity lookup

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query parameters are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // If doctor name is provided, first look up the provider ID
    let providerId: string | null = null;
    if (doctorName) {
      const doctorNameClean = doctorName.replace(/^Dr\.\s*/i, "").trim();
      
      // Try to find provider by name
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .or(`name.ilike.*${doctorNameClean}*,name.ilike.*${doctorNameClean.split(" ")[0]}*`)
        .limit(1)
        .single();
      
      if (provider) {
        providerId = provider.id;
      }
    }

    // Fetch appointments within the date range
    let query = supabase
      .from("appointments")
      .select("id, start_time, end_time, status, reason, no_patient, provider_id")
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

    // Exclude no_patient appointments (placeholder bookings that don't block real patients)
    let filteredAppointments = (appointments || []).filter(
      (apt) => apt.no_patient !== true
    );
    
    // Filter by doctor if specified
    if (doctorName) {
      const doctorNameLower = doctorName.toLowerCase().replace(/^dr\.\s*/i, "");
      
      filteredAppointments = filteredAppointments.filter((apt) => {
        // First, check by provider_id (most reliable)
        if (providerId && apt.provider_id === providerId) {
          return true;
        }
        
        // Fallback: check the reason field for [Doctor: Name] pattern
        if (apt.reason) {
          const match = apt.reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
          if (match && match[1].toLowerCase().includes(doctorNameLower)) {
            return true;
          }
        }
        
        return false;
      });
    }

    // Count appointments per 30-minute slot to determine which slots are full
    // A slot is only "full" when it has MAX_CONCURRENT_APPOINTMENTS
    const slotCounts: Record<string, number> = {};
    
    filteredAppointments.forEach((apt) => {
      const aptStart = new Date(apt.start_time);
      const aptEnd = apt.end_time ? new Date(apt.end_time) : new Date(aptStart.getTime() + 60 * 60 * 1000);
      
      // Generate all 30-minute slots this appointment covers
      let slotTime = new Date(aptStart);
      while (slotTime < aptEnd) {
        const slotKey = slotTime.toISOString();
        slotCounts[slotKey] = (slotCounts[slotKey] || 0) + 1;
        slotTime = new Date(slotTime.getTime() + 30 * 60 * 1000);
      }
    });

    // Get the max capacity for this doctor
    const maxCapacity = getMaxCapacity(doctorSlug);

    // Return appointments, slot counts, and which slots are fully booked
    const fullSlots = Object.entries(slotCounts)
      .filter(([_, count]) => count >= maxCapacity)
      .map(([slot, _]) => slot);

    return NextResponse.json({ 
      appointments: filteredAppointments,
      slotCounts,
      fullSlots,
      maxConcurrent: maxCapacity
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
