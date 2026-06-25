import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatSwissDateWithWeekday, formatSwissTimeAmPm } from "@/lib/swissTimezone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Doctor-specific capacity: these doctors can have 2 concurrent bookings.
const MULTI_CAPACITY_DOCTORS = ["xavier-tenorio", "cesar-rodriguez", "yulia-raspertova"];

function getMaxCapacity(doctorSlug: string | null): number {
  if (!doctorSlug) return 1;
  return MULTI_CAPACITY_DOCTORS.includes(doctorSlug) ? 2 : 1;
}

export const runtime = "nodejs";

/**
 * GET /api/retell/booking-slots?service={serviceName}&doctor={doctorName}&days={days}
 * 
 * Returns available booking slots for the next N days for a specific service and doctor.
 * This is designed for Retell AI to fetch slots during a conversation.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get("service");
    const doctorName = searchParams.get("doctor");
    const doctorSlug = searchParams.get("slug");
    const days = parseInt(searchParams.get("days") || "14", 10); // Default 14 days

    if (!serviceName) {
      return NextResponse.json(
        { error: "service parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the service by name (case-insensitive partial match)
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, description, base_price")
      .ilike("name", `%${serviceName}%`)
      .limit(1)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: `Service not found: ${serviceName}` },
        { status: 404 }
      );
    }

    // Look up provider if doctor name is provided
    let providerId: string | null = null;
    let actualDoctorName = doctorName;
    let actualDoctorSlug = doctorSlug;

    if (doctorName) {
      const doctorNameClean = doctorName.replace(/^Dr\.\s*/i, "").trim();
      
      const { data: provider } = await supabase
        .from("providers")
        .select("id, name, slug")
        .or(`name.ilike.*${doctorNameClean}*,name.ilike.*${doctorNameClean.split(" ")[0]}*`)
        .limit(1)
        .single();
      
      if (provider) {
        providerId = provider.id;
        actualDoctorName = provider.name;
        actualDoctorSlug = provider.slug || doctorSlug;
      }
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    endDate.setHours(23, 59, 59, 999);

    // Fetch appointments that could OVERLAP with any slot in the date range
    // We need appointments that: start before range ends AND end after range starts
    let query = supabase
      .from("appointments")
      .select("id, start_time, end_time, status, reason, no_patient, provider_id")
      .lt("start_time", endDate.toISOString())   // starts before range ends
      .gt("end_time", startDate.toISOString())   // ends after range starts
      .neq("status", "cancelled");

    const { data: appointments, error: aptError } = await query;

    if (aptError) {
      console.error("[Retell Booking Slots] Error fetching appointments:", aptError);
      return NextResponse.json(
        { error: "Failed to fetch appointments" },
        { status: 500 }
      );
    }

    // PAUSE/no_patient appointments now BLOCK booking (not skipped)
    // This ensures doctor breaks, meetings etc. prevent online bookings
    let filteredAppointments = appointments || [];

    if (doctorName && providerId) {
      const doctorNameLower = doctorName.toLowerCase().replace(/^dr\.\s*/i, "");
      
      filteredAppointments = filteredAppointments.filter((apt) => {
        if (providerId && apt.provider_id === providerId) {
          return true;
        }
        if (apt.reason) {
          const match = apt.reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
          if (match && match[1].toLowerCase().includes(doctorNameLower)) {
            return true;
          }
        }
        return false;
      });
    }

    // Generate available slots
    // Working hours: 9 AM to 6 PM, Monday to Saturday
    const maxCapacity = getMaxCapacity(actualDoctorSlug);
    const availableSlots: Array<{
      date: string;
      time: string;
      formatted: string;
      iso: string;
    }> = [];

    const currentSlot = new Date(startDate);
    
    // Round to next 30-minute slot if today
    if (currentSlot.getDate() === now.getDate()) {
      const minutes = currentSlot.getMinutes();
      const roundedMinutes = Math.ceil(minutes / 30) * 30;
      currentSlot.setMinutes(roundedMinutes);
      if (currentSlot < now) {
        currentSlot.setMinutes(currentSlot.getMinutes() + 30);
      }
    }

    while (currentSlot < endDate) {
      const dayOfWeek = currentSlot.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = currentSlot.getHours();

      // Skip Sundays (0) and outside working hours (9-18)
      if (dayOfWeek !== 0 && hour >= 9 && hour < 18) {
        // A first-consultation booking at this slot is 30 minutes long
        const proposedEnd = new Date(currentSlot.getTime() + 30 * 60 * 1000);
        
        // Count appointments that OVERLAP with a 30-minute booking at this slot
        // Overlap: existing starts before proposed ends AND existing ends after proposed starts
        const overlappingAppointments = filteredAppointments.filter((apt) => {
          const aptStart = new Date(apt.start_time);
          const aptEnd = new Date(apt.end_time);
          return aptStart < proposedEnd && aptEnd > currentSlot;
        });

        // If slot has capacity, add to available
        if (overlappingAppointments.length < maxCapacity) {
          availableSlots.push({
            date: currentSlot.toISOString().split("T")[0],
            time: formatSwissTimeAmPm(currentSlot),
            formatted: formatSwissDateWithWeekday(currentSlot) + " at " + formatSwissTimeAmPm(currentSlot),
            iso: currentSlot.toISOString(),
          });
        }
      }

      // Move to next 30-minute slot
      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
    }

    // Group by date for easier consumption
    const slotsByDate: Record<string, typeof availableSlots> = {};
    for (const slot of availableSlots) {
      if (!slotsByDate[slot.date]) {
        slotsByDate[slot.date] = [];
      }
      slotsByDate[slot.date].push(slot);
    }

    return NextResponse.json({
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        price_chf: service.base_price,
      },
      doctor: actualDoctorName ? {
        name: actualDoctorName,
        slug: actualDoctorSlug,
      } : null,
      total_slots: availableSlots.length,
      slots: availableSlots.slice(0, 20), // Return first 20 slots
      slots_by_date: slotsByDate,
      max_capacity: maxCapacity,
    });

  } catch (error) {
    console.error("[Retell Booking Slots] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking slots" },
      { status: 500 }
    );
  }
}
