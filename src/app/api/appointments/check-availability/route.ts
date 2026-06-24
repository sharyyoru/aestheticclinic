import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CONSULTATION_DURATION_MS,
  appointmentOccupiesDoctorSlot,
  describeBlocking,
  fetchOverlappingAppointments,
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
  const location = searchParams.get("location"); // Optional: scopes the untagged-appointment safeguard

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

    // Pre-filter to the appointments that occupy THIS doctor's slot once
    // (instead of scanning every appointment for every slot), and precompute
    // their start/end as millis. This turns the per-slot scan from
    // O(slots * allAppointments) into O(slots * relevantAppointments), which
    // keeps the 3-month range query fast.
    //
    // appointmentOccupiesDoctorSlot also folds in the SAFEGUARD: an unattributed
    // appointment (no provider_id, no [Doctor:] tag) blocks the slot unless it is
    // clearly at a different location — so a PAUSE/appointment a staff member
    // saves without picking a doctor can never leave the slot bookable online.
    const doctorAppts = appointments
      .filter((a) => appointmentOccupiesDoctorSlot(a, { providerId, doctorName, bookingLocation: location }))
      .map((a) => ({ apt: a, start: new Date(a.start_time).getTime(), end: new Date(a.end_time).getTime() }));

    // Generate all 30-minute slots in the requested range.
    const rangeEndMs = new Date(end).getTime();
    const stepMs = 30 * 60 * 1000;
    const firstSlot = new Date(start);
    firstSlot.setMinutes(Math.floor(firstSlot.getMinutes() / 30) * 30, 0, 0);

    const slotCounts: Record<string, number> = {};
    const slotDebug: Record<string, ReturnType<typeof describeBlocking>[]> = {};
    for (let slotStartMs = firstSlot.getTime(); slotStartMs < rangeEndMs; slotStartMs += stepMs) {
      const slotEndMs = slotStartMs + CONSULTATION_DURATION_MS;
      const blocking = doctorAppts.filter((da) => da.start < slotEndMs && da.end > slotStartMs);
      if (blocking.length > 0) {
        const iso = new Date(slotStartMs).toISOString();
        slotCounts[iso] = blocking.length;
        if (debug) slotDebug[iso] = blocking.map((da) => describeBlocking(da.apt, providerId));
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
