import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CONSULTATION_DURATION_MS,
  describeBlocking,
  fetchOverlappingAppointments,
  getBlockingAppointments,
  getMaxCapacity,
  resolveProviderId,
} from "@/lib/appointmentAvailability";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const debug = searchParams.get("debug") === "1";

    // SINGLE SOURCE OF TRUTH: identical provider resolution + appointment
    // attribution as the booking validator (see src/lib/appointmentAvailability.ts).
    const providerId = await resolveProviderId(supabase, doctorName);

    // PAUSE/no_patient appointments BLOCK booking and ARE included here, matching
    // /api/public/book-appointment and /api/retell/*. Keeping both sides on the
    // same helpers guarantees every offered slot can actually be booked (no more
    // "fully booked (2/1)" 409 at confirmation).
    const appointments = await fetchOverlappingAppointments(supabase, start, end);

    const maxCapacity = getMaxCapacity(doctorSlug);

    // Generate all 30-minute slots in the requested range.
    const rangeEnd = new Date(end);
    const allSlots: Date[] = [];
    const currentSlot = new Date(start);
    currentSlot.setMinutes(Math.floor(currentSlot.getMinutes() / 30) * 30, 0, 0);
    while (currentSlot < rangeEnd) {
      allSlots.push(new Date(currentSlot));
      currentSlot.setTime(currentSlot.getTime() + 30 * 60 * 1000);
    }

    // For each slot, count the doctor's blocking (belonging + overlapping)
    // appointments using the shared helper.
    const slotCounts: Record<string, number> = {};
    const slotDebug: Record<string, ReturnType<typeof describeBlocking>[]> = {};
    for (const slotStart of allSlots) {
      const slotEnd = new Date(slotStart.getTime() + CONSULTATION_DURATION_MS);
      const blocking = getBlockingAppointments(appointments, {
        providerId,
        doctorName,
        slotStart,
        slotEnd,
      });
      if (blocking.length > 0) {
        slotCounts[slotStart.toISOString()] = blocking.length;
        if (debug) slotDebug[slotStart.toISOString()] = blocking.map((a) => describeBlocking(a, providerId));
      }
    }

    const fullSlots = Object.entries(slotCounts)
      .filter(([, count]) => count >= maxCapacity)
      .map(([slot]) => slot);

    return NextResponse.json({
      slotCounts,
      fullSlots,
      maxConcurrent: maxCapacity,
      providerResolved: Boolean(providerId),
      ...(debug ? { slotDebug } : {}),
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
