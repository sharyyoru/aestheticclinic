import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatSwissDateWithWeekday, formatSwissTimeAmPm } from "@/lib/swissTimezone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = "nodejs";

/**
 * Location definitions with descriptions
 */
const CLINIC_LOCATIONS = {
  rhone: { name: "Rhône", label: "Geneva - Rue du Rhône", city: "Geneva" },
  champel: { name: "Champel", label: "Geneva - Champel", city: "Geneva" },
  gstaad: { name: "Gstaad", label: "Gstaad", city: "Gstaad" },
  montreux: { name: "Montreux", label: "Montreux", city: "Montreux" },
};

/**
 * Doctor availability by location
 * Format: { [doctorSlug]: { [locationId]: { [dayOfWeek]: { start, end } } } }
 * dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
const DOCTOR_AVAILABILITY: Record<string, Record<string, Record<number, { start: string; end: string }>>> = {
  "xavier-tenorio": {
    rhone: {
      1: { start: "14:00", end: "18:30" },
      5: { start: "14:00", end: "18:30" },
    },
    montreux: {
      4: { start: "10:00", end: "12:30" },
    },
    gstaad: {
      6: { start: "16:00", end: "18:30" },
    },
  },
  "yulia-raspertova": {
    rhone: {
      1: { start: "10:00", end: "18:30" },
      2: { start: "10:00", end: "12:30" },
      4: { start: "10:00", end: "18:30" },
      3: { start: "08:00", end: "12:00" },
      5: { start: "08:00", end: "12:00" },
    },
    champel: {
      2: { start: "14:00", end: "18:30" },
    },
  },
  "cesar-rodriguez": {
    champel: {
      2: { start: "13:00", end: "17:00" },
      5: { start: "13:00", end: "17:00" },
    },
    rhone: {
      1: { start: "14:00", end: "18:30" },
      5: { start: "14:00", end: "18:30" },
    },
    montreux: {
      3: { start: "15:00", end: "17:00" },
    },
  },
  clinic: {
    champel: {
      1: { start: "10:00", end: "18:30" },
      2: { start: "10:00", end: "12:00" },
      3: { start: "10:00", end: "12:00" },
      4: { start: "10:00", end: "12:00" },
      5: { start: "10:00", end: "12:00" },
      6: { start: "10:00", end: "12:00" },
    },
  },
  "lily-radionova": {
    gstaad: {
      1: { start: "10:00", end: "18:30" },
      2: { start: "10:00", end: "18:30" },
      3: { start: "10:00", end: "18:30" },
      4: { start: "10:00", end: "18:30" },
      5: { start: "10:00", end: "18:30" },
      6: { start: "10:00", end: "18:30" },
    },
  },
};

/**
 * Service type to doctor mapping
 * Determines which doctors can perform which types of services
 */
const SERVICE_DOCTOR_MAPPING: Record<string, string[]> = {
  // Plastic surgery - only plastic surgeons
  "breast augmentation": ["xavier-tenorio", "cesar-rodriguez"],
  "breast lift": ["xavier-tenorio", "cesar-rodriguez"],
  "breast reduction": ["xavier-tenorio", "cesar-rodriguez"],
  rhinoplasty: ["xavier-tenorio", "cesar-rodriguez"],
  facelift: ["xavier-tenorio", "cesar-rodriguez"],
  liposuction: ["xavier-tenorio", "cesar-rodriguez"],
  "tummy tuck": ["xavier-tenorio", "cesar-rodriguez"],
  abdominoplasty: ["xavier-tenorio", "cesar-rodriguez"],
  blepharoplasty: ["xavier-tenorio", "cesar-rodriguez"],
  "eyelid surgery": ["xavier-tenorio", "cesar-rodriguez"],

  // Dermatology / Non-surgical - dermatologist or clinic
  botox: ["yulia-raspertova", "lily-radionova"],
  "face filler": ["yulia-raspertova", "lily-radionova"],
  "lip filler": ["yulia-raspertova", "lily-radionova"],
  filler: ["yulia-raspertova", "lily-radionova"],
  "anti-aging": ["yulia-raspertova", "lily-radionova"],
  wrinkle: ["yulia-raspertova", "lily-radionova"],

  // Laser and clinic treatments
  laser: ["clinic", "lily-radionova"],
  "iv therapy": ["clinic"],
  hyperbaric: ["clinic"],
  hbot: ["clinic"],

  // General consultation - all doctors
  consultation: ["xavier-tenorio", "cesar-rodriguez", "yulia-raspertova", "clinic", "lily-radionova"],
  general: ["xavier-tenorio", "cesar-rodriguez", "yulia-raspertova", "clinic", "lily-radionova"],
};

const DOCTOR_NAMES: Record<string, string> = {
  "xavier-tenorio": "Dr. Xavier Tenorio",
  "cesar-rodriguez": "Dr. Cesar Rodriguez",
  "yulia-raspertova": "Dr. Yulia Raspertova",
  clinic: "Laser & Treatments",
  "lily-radionova": "Nurse Lily Radionova",
};

// Maps doctor slugs to keywords that appear in provider names
const DOCTOR_NAME_KEYWORDS: Record<string, string[]> = {
  "xavier-tenorio": ["tenorio", "xavier"],
  "cesar-rodriguez": ["rodriguez", "cesar"],
  "yulia-raspertova": ["raspertova", "yulia"],
  clinic: ["clinic", "laser"],
  "lily-radionova": ["radionova", "lily"],
};

const MULTI_CAPACITY_DOCTORS = ["xavier-tenorio", "cesar-rodriguez"];

function getMaxCapacity(doctorSlug: string): number {
  return MULTI_CAPACITY_DOCTORS.includes(doctorSlug) ? 3 : 1;
}

/**
 * Find which doctors can perform a service based on keywords
 */
function findDoctorsForService(serviceName: string): string[] {
  const normalized = serviceName.toLowerCase();

  // Direct match
  for (const [keyword, doctors] of Object.entries(SERVICE_DOCTOR_MAPPING)) {
    if (normalized.includes(keyword)) {
      return doctors;
    }
  }

  // Default to consultation doctors (all)
  return SERVICE_DOCTOR_MAPPING.consultation;
}

/**
 * Get locations where a service can be performed
 * Based on which doctors can do the service and where they work
 */
function getLocationsForService(serviceName: string): string[] {
  const doctors = findDoctorsForService(serviceName);
  const locations = new Set<string>();

  for (const doctor of doctors) {
    const availability = DOCTOR_AVAILABILITY[doctor];
    if (availability) {
      for (const location of Object.keys(availability)) {
        locations.add(location);
      }
    }
  }

  return Array.from(locations);
}

/**
 * POST /api/retell/check-availability
 *
 * Unified endpoint for Retell AI to check appointment availability.
 * Handles the full flow: service → location → doctor → available slots
 *
 * Request body:
 * {
 *   action: "get_services" | "get_locations" | "get_slots" | "get_next_available"
 *   service_name?: string  // Required for get_locations, get_slots, get_next_available
 *   location?: string      // Required for get_slots
 *   doctor_slug?: string   // Optional for get_slots (will auto-select best match)
 *   days?: number          // Optional, default 14
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, location, doctor_slug, days = 14 } = body;
    // Default to "consultation" if no service specified - this shows ALL doctors
    const service_name = body.service_name || "consultation";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: get_services - List all available services
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "get_services") {
      const { data: services, error } = await supabase
        .from("services")
        .select("id, name, description, base_price, category:service_categories(name)")
        .eq("is_active", true)
        .order("name");

      if (error) {
        return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
      }

      // Group by category for easier navigation
      const byCategory: Record<string, Array<{ name: string; price: number; description: string }>> = {};
      for (const s of services || []) {
        const cat = (s as unknown as { category?: { name?: string } }).category?.name || "Other";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({
          name: s.name,
          price: s.base_price,
          description: s.description || "",
        });
      }

      return NextResponse.json({
        success: true,
        action: "get_services",
        services_by_category: byCategory,
        total_count: services?.length || 0,
        instruction: "Ask the patient which service they are interested in, then use get_locations to find where it's available.",
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: get_locations - Get locations where a service is available
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "get_locations") {
      if (!service_name) {
        return NextResponse.json({
          error: "service_name is required",
          instruction: "First ask which service the patient wants, then call get_locations with that service_name",
        }, { status: 400 });
      }

      const locationIds = getLocationsForService(service_name);
      const doctors = findDoctorsForService(service_name);

      const locations = locationIds.map((id) => {
        const loc = CLINIC_LOCATIONS[id as keyof typeof CLINIC_LOCATIONS];
        const availableDoctors = doctors
          .filter((d) => DOCTOR_AVAILABILITY[d]?.[id])
          .map((d) => DOCTOR_NAMES[d]);

        return {
          id,
          name: loc?.name || id,
          label: loc?.label || id,
          city: loc?.city || "Geneva",
          doctors: availableDoctors,
        };
      });

      return NextResponse.json({
        success: true,
        action: "get_locations",
        service: service_name,
        locations,
        instruction: "Ask the patient which location they prefer, then use get_slots to find available times.",
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: get_slots - Get available booking slots for a service at a location
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "get_slots") {
      if (!location) {
        return NextResponse.json({
          error: "location is required",
          instruction: "Ask which location the patient prefers: rhone, champel, gstaad, or montreux",
        }, { status: 400 });
      }

      // Find which doctors can do this service at this location
      const serviceDoctors = findDoctorsForService(service_name);
      const locationDoctors = serviceDoctors.filter(
        (d) => DOCTOR_AVAILABILITY[d]?.[location]
      );

      if (locationDoctors.length === 0) {
        return NextResponse.json({
          success: false,
          error: "No doctors available for this service at this location",
          suggestion: "Try a different location",
          available_locations: getLocationsForService(service_name),
        });
      }

      // If specific doctor requested, validate they can do this service at this location
      let targetDoctors = locationDoctors;
      if (doctor_slug && locationDoctors.includes(doctor_slug)) {
        targetDoctors = [doctor_slug];
      }

      // Calculate date range
      const now = new Date();
      const startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + days);
      endDate.setHours(23, 59, 59, 999);

      // Fetch existing appointments with provider info
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status, reason, no_patient, provider_id, provider:providers(id, name)")
        .lt("start_time", endDate.toISOString())
        .gt("end_time", startDate.toISOString())
        .neq("status", "cancelled");

      // PAUSE/no_patient appointments now BLOCK booking (not skipped)
      // This ensures doctor breaks, meetings etc. prevent online bookings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredAppointments = (appointments || []) as Array<any>;
      
      // Debug: Log appointments for troubleshooting slot availability
      console.log(`[Check Availability] Found ${filteredAppointments.length} appointments in date range`);
      if (filteredAppointments.length > 0) {
        console.log(`[Check Availability] Sample appointments:`, 
          filteredAppointments.slice(0, 5).map(a => ({
            start: a.start_time,
            reason: a.reason?.substring(0, 100),
            provider: a.provider?.name,
            provider_id: a.provider_id
          }))
        );
      }

      // Generate slots for each doctor
      const allSlots: Array<{
        date: string;
        time: string;
        formatted: string;
        iso: string;
        doctor: string;
        doctor_slug: string;
        location: string;
      }> = [];

      for (const docSlug of targetDoctors) {
        const availability = DOCTOR_AVAILABILITY[docSlug]?.[location];
        if (!availability) continue;

        const maxCapacity = getMaxCapacity(docSlug);
        const currentSlot = new Date(startDate);

        while (currentSlot < endDate) {
          const dayOfWeek = currentSlot.getDay();
          const dayAvail = availability[dayOfWeek];

          if (dayAvail) {
            // Parse start/end times
            const [startH, startM] = dayAvail.start.split(":").map(Number);
            const [endH, endM] = dayAvail.end.split(":").map(Number);

            // Set to day start time
            const slotTime = new Date(currentSlot);
            slotTime.setHours(startH, startM, 0, 0);

            const dayEnd = new Date(currentSlot);
            dayEnd.setHours(endH, endM, 0, 0);

            // Skip if today and slot is in the past
            if (slotTime.toDateString() === now.toDateString() && slotTime < now) {
              // Round up to next 30-min slot
              const minutes = now.getMinutes();
              const roundedMinutes = Math.ceil(minutes / 30) * 30;
              slotTime.setHours(now.getHours(), roundedMinutes, 0, 0);
              if (slotTime < now) {
                slotTime.setMinutes(slotTime.getMinutes() + 30);
              }
            }

            while (slotTime < dayEnd) {
              const proposedEnd = new Date(slotTime.getTime() + 60 * 60 * 1000);

              // Count overlapping appointments for this doctor
              const overlapping = filteredAppointments.filter((apt) => {
                const aptStart = new Date(apt.start_time);
                const aptEnd = new Date(apt.end_time);
                if (!(aptStart < proposedEnd && aptEnd > slotTime)) return false;

                // Check if this appointment is for this doctor using multiple methods:
                const keywords = DOCTOR_NAME_KEYWORDS[docSlug] || [];
                
                // Method 1: Check provider name from join
                const providerName = apt.provider?.name?.toLowerCase() || "";
                if (providerName && keywords.some(kw => providerName.includes(kw))) {
                  return true;
                }
                
                // Method 2: Check [Doctor:] tag in reason field
                if (apt.reason) {
                  const reasonLower = apt.reason.toLowerCase();
                  const doctorMatch = apt.reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
                  if (doctorMatch) {
                    const taggedDoctor = doctorMatch[1].toLowerCase();
                    if (keywords.some(kw => taggedDoctor.includes(kw))) {
                      return true;
                    }
                  }
                  // Also check if doctor name appears anywhere in reason
                  if (keywords.some(kw => reasonLower.includes(kw))) {
                    return true;
                  }
                }
                
                // Method 3: If no provider/reason match, assume it blocks if times overlap
                // This is safer - unknown appointments block the slot
                if (!apt.provider_id && !apt.reason?.includes("[Doctor:")) {
                  return true;
                }
                
                return false;
              });

              if (overlapping.length < maxCapacity) {
                allSlots.push({
                  date: slotTime.toISOString().split("T")[0],
                  time: formatSwissTimeAmPm(slotTime),
                  formatted: formatSwissDateWithWeekday(slotTime) + " at " + formatSwissTimeAmPm(slotTime),
                  iso: slotTime.toISOString(),
                  doctor: DOCTOR_NAMES[docSlug],
                  doctor_slug: docSlug,
                  location: CLINIC_LOCATIONS[location as keyof typeof CLINIC_LOCATIONS]?.name || location,
                });
              }

              slotTime.setMinutes(slotTime.getMinutes() + 30);
            }
          }

          // Move to next day
          currentSlot.setDate(currentSlot.getDate() + 1);
          currentSlot.setHours(0, 0, 0, 0);
        }
      }

      // Sort by date/time
      allSlots.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());

      // Group by date
      const slotsByDate: Record<string, typeof allSlots> = {};
      for (const slot of allSlots) {
        if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
        slotsByDate[slot.date].push(slot);
      }

      // Get first 5 available slots for quick suggestion
      const nextAvailable = allSlots.slice(0, 5);

      return NextResponse.json({
        success: true,
        action: "get_slots",
        service: service_name,
        location: CLINIC_LOCATIONS[location as keyof typeof CLINIC_LOCATIONS]?.name || location,
        doctors: targetDoctors.map((d) => DOCTOR_NAMES[d]),
        total_slots: allSlots.length,
        next_available: nextAvailable,
        slots_by_date: slotsByDate,
        instruction: nextAvailable.length > 0
          ? `Suggest these times to the patient: ${nextAvailable.slice(0, 3).map((s) => s.formatted + " with " + s.doctor).join(", ")}. When they choose, use /api/retell/book-appointment to complete the booking.`
          : "No slots available in the next " + days + " days. Offer to check more dates or a different location.",
        _debug: {
          appointments_in_range: filteredAppointments.length,
          sample_appointments: filteredAppointments.slice(0, 3).map(a => ({
            start: a.start_time,
            reason: a.reason?.substring(0, 80),
            provider_name: a.provider?.name || a.provider?.[0]?.name,
            provider_id: a.provider_id
          }))
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: get_next_available - Quick check for next available slot
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "get_next_available") {
      // service_name defaults to "consultation" if not provided

      const locations = getLocationsForService(service_name);
      const results: Array<{
        location: string;
        location_id: string;
        next_slot: string;
        doctor: string;
        iso: string;
      }> = [];

      // Check each location for next available
      for (const loc of locations) {
        // Reuse get_slots logic (simplified)
        const serviceDoctors = findDoctorsForService(service_name);
        const locationDoctors = serviceDoctors.filter(
          (d) => DOCTOR_AVAILABILITY[d]?.[loc]
        );

        if (locationDoctors.length === 0) continue;

        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 14);

        // Find first available slot
        for (const docSlug of locationDoctors) {
          const availability = DOCTOR_AVAILABILITY[docSlug]?.[loc];
          if (!availability) continue;

          const maxCapacity = getMaxCapacity(docSlug);
          const currentSlot = new Date(now);
          currentSlot.setHours(0, 0, 0, 0);

          slotSearch: while (currentSlot < endDate) {
            const dayOfWeek = currentSlot.getDay();
            const dayAvail = availability[dayOfWeek];

            if (dayAvail) {
              const [startH, startM] = dayAvail.start.split(":").map(Number);
              const [endH, endM] = dayAvail.end.split(":").map(Number);

              const slotTime = new Date(currentSlot);
              slotTime.setHours(startH, startM, 0, 0);

              const dayEnd = new Date(currentSlot);
              dayEnd.setHours(endH, endM, 0, 0);

              if (slotTime > now || slotTime.toDateString() !== now.toDateString()) {
                results.push({
                  location: CLINIC_LOCATIONS[loc as keyof typeof CLINIC_LOCATIONS]?.name || loc,
                  location_id: loc,
                  next_slot: formatSwissDateWithWeekday(slotTime) + " at " + formatSwissTimeAmPm(slotTime),
                  doctor: DOCTOR_NAMES[docSlug],
                  iso: slotTime.toISOString(),
                });
                break slotSearch;
              }
            }

            currentSlot.setDate(currentSlot.getDate() + 1);
            currentSlot.setHours(0, 0, 0, 0);
          }
        }
      }

      // Sort by earliest slot
      results.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());

      return NextResponse.json({
        success: true,
        action: "get_next_available",
        service: service_name,
        availability: results,
        instruction: results.length > 0
          ? `The soonest available is ${results[0].next_slot} at ${results[0].location} with ${results[0].doctor}. Ask if this works or if they prefer a different location/time.`
          : "No availability found in the next 2 weeks. Offer to take their details and have someone call them back.",
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unknown action
    // ─────────────────────────────────────────────────────────────────────────
    return NextResponse.json({
      error: "Unknown action",
      valid_actions: ["get_services", "get_locations", "get_slots", "get_next_available"],
      usage: {
        get_services: "List all services",
        get_locations: "Get locations for a service (requires service_name)",
        get_slots: "Get available slots (requires service_name, location)",
        get_next_available: "Quick check for soonest slot (requires service_name)",
      },
    }, { status: 400 });

  } catch (error) {
    console.error("[Check Availability] Error:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for Retell configuration info
 */
export async function GET() {
  return NextResponse.json({
    name: "check_availability",
    description: "Check appointment availability for services at clinic locations. Use this instead of directing patients to the website.",
    endpoint: "POST /api/retell/check-availability",
    actions: {
      get_services: {
        description: "List all available services grouped by category",
        parameters: {},
      },
      get_locations: {
        description: "Get locations where a specific service is available",
        parameters: {
          service_name: "string (required) - Name of the service",
        },
      },
      get_slots: {
        description: "Get available booking slots for a service at a location",
        parameters: {
          service_name: "string (required)",
          location: "string (required) - rhone, champel, gstaad, or montreux",
          doctor_slug: "string (optional) - Specific doctor preference",
          days: "number (optional, default 14) - How many days ahead to check",
        },
      },
      get_next_available: {
        description: "Quick check for the soonest available slot across all locations",
        parameters: {
          service_name: "string (required)",
        },
      },
    },
    flow: "1. get_services → 2. get_locations → 3. get_slots → 4. /api/retell/book-appointment",
  });
}
