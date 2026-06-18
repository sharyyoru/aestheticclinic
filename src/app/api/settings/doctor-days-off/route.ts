import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET all per-doctor days-off rows. Public (used by the booking pages), same
// pattern as /api/settings/blocked-dates.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("booking_doctor_days_off")
      .select("slug, days_off, updated_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ daysOff: data || [] });
  } catch (err) {
    console.error("GET doctor-days-off error:", err);
    return NextResponse.json({ error: "Failed to fetch doctor days off" }, { status: 500 });
  }
}

// POST upserts the days-off list for a single doctor.
// Body: { slug: string, days_off: number[] }  (weekday numbers, 0=Sun..6=Sat)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    const rawDays = Array.isArray(body?.days_off) ? body.days_off : [];

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    // Normalise: unique integers within 0..6.
    const normalised: number[] = rawDays
      .map((d: unknown) => Number(d))
      .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);
    const daysOff: number[] = Array.from(new Set<number>(normalised)).sort(
      (a, b) => a - b,
    );

    const { data, error } = await supabaseAdmin
      .from("booking_doctor_days_off")
      .upsert(
        { slug, days_off: daysOff, updated_at: new Date().toISOString() },
        { onConflict: "slug" },
      )
      .select("slug, days_off, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ daysOff: data });
  } catch (err) {
    console.error("POST doctor-days-off error:", err);
    return NextResponse.json({ error: "Failed to save doctor days off" }, { status: 500 });
  }
}
