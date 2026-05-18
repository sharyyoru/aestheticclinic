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

    // Fetch appointments that could OVERLAP with any slot in the date range
    // We need appointments that: start before range ends AND end after range starts
    // This ensures we catch appointments that started earlier but still overlap
    let query = supabase
      .from("appointments")
      .select("id, start_time, end_time, status, reason, no_patient, provider_id")
      .lt("start_time", end)      // starts before range ends
      .gt("end_time", start)      // ends after range starts
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

    // Count appointments per 30-minute slot using OVERLAP detection
    // A slot is blocked if any existing appointment overlaps with a 1-hour appointment starting at that slot
    // This matches the booking API logic exactly (which also checks for overlaps)
    const slotCounts: Record<string, number> = {};
    
    // Generate all 30-minute slots for the requested time range
    const rangeStart = new Date(start);
    const rangeEnd = new Date(end);
    const allSlots: Date[] = [];
    
    let currentSlot = new Date(rangeStart);
    // Round to nearest 30 minutes
    currentSlot.setMinutes(Math.floor(currentSlot.getMinutes() / 30) * 30, 0, 0);
    
    while (currentSlot < rangeEnd) {
      allSlots.push(new Date(currentSlot));
      currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
    }
    
    // For each 30-minute slot, count appointments that OVERLAP with a 1-hour appointment starting at that slot
    // Overlap condition: existing.start < proposed.end AND existing.end > proposed.start
    allSlots.forEach((slotStart) => {
      // A booking at this slot would be 1 hour long
      const proposedEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      
      const overlappingAppointments = filteredAppointments.filter((apt) => {
        const aptStart = new Date(apt.start_time);
        const aptEnd = new Date(apt.end_time);
        // Overlap: existing starts before proposed ends AND existing ends after proposed starts
        return aptStart < proposedEnd && aptEnd > slotStart;
      });
      
      if (overlappingAppointments.length > 0) {
        slotCounts[slotStart.toISOString()] = overlappingAppointments.length;
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
