/**
 * Comprehensive booking availability test.
 *
 * For every doctor x every location, replays the EXACT production availability
 * logic against the live database and reports whether at least one slot is
 * bookable in the next 90 days. Reuses the shared helpers so this test matches
 * what the booking pages actually do.
 *
 * Run: npx tsx scripts/booking-availability-test.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  CONSULTATION_DURATION_MS,
  appointmentBelongsToDoctor,
  fetchOverlappingAppointments,
  getMaxCapacity,
  overlapsSlot,
  resolveProviderId,
  type AppointmentRow,
} from "../src/lib/appointmentAvailability";
import {
  createSwissDateTime,
  getSwissDayOfWeek,
  getSwissDayRange,
  getSwissToday,
  formatSwissYmd,
} from "../src/lib/swissTimezone";

// ---- Load env from .env.local --------------------------------------------
function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---- Canonical config (mirrors the booking pages) -------------------------
const DOCTORS: Record<string, string> = {
  "xavier-tenorio": "Dr. Xavier Tenorio",
  "cesar-rodriguez": "Dr. Cesar Rodriguez",
  "yulia-raspertova": "Dr. Yulia Raspertova",
  clinic: "Laser & Treatments",
  "lily-radionova": "Nurse Lily Radionova",
};

const LOCATIONS = ["rhone", "champel", "gstaad", "montreux"];

const DOCTOR_AVAILABILITY: Record<string, Record<string, Record<number, { start: string; end: string }>>> = {
  "xavier-tenorio": {
    rhone: { 1: { start: "14:00", end: "18:30" }, 5: { start: "14:00", end: "18:30" } },
    montreux: { 4: { start: "10:00", end: "12:30" } },
    gstaad: { 6: { start: "16:00", end: "18:30" } },
  },
  "yulia-raspertova": {
    rhone: {
      1: { start: "10:00", end: "18:30" },
      2: { start: "10:00", end: "12:30" },
      4: { start: "10:00", end: "18:30" },
      3: { start: "08:00", end: "12:00" },
      5: { start: "08:00", end: "12:00" },
    },
    champel: { 2: { start: "14:00", end: "18:30" } },
  },
  "cesar-rodriguez": {
    champel: { 2: { start: "13:00", end: "17:00" }, 5: { start: "13:00", end: "17:00" } },
    rhone: { 1: { start: "14:00", end: "18:30" }, 5: { start: "14:00", end: "18:30" } },
    montreux: { 3: { start: "15:00", end: "17:00" } },
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

function generateTimeSlots(slug: string, location: string, dateStr: string): string[] {
  const dow = getSwissDayOfWeek(dateStr + "T12:00:00");
  const a = DOCTOR_AVAILABILITY[slug]?.[location]?.[dow];
  if (!a) return [];
  const [sh, sm] = a.start.split(":").map(Number);
  const [eh, em] = a.end.split(":").map(Number);
  const slots: string[] = [];
  let h = sh;
  let m = sm;
  while (h < eh || (h === eh && m < em)) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30;
    if (m >= 60) { m = 0; h += 1; }
  }
  return slots;
}

function getCandidateDates(slug: string, location: string, maxDaysAhead = 90): string[] {
  const today = getSwissToday();
  const dates: string[] = [];
  for (let i = 1; i <= maxDaysAhead; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ymd = formatSwissYmd(d);
    const dow = getSwissDayOfWeek(ymd + "T12:00:00");
    if (DOCTOR_AVAILABILITY[slug]?.[location]?.[dow]) dates.push(ymd);
  }
  return dates;
}

async function getDaysOff(slug: string): Promise<Set<number>> {
  const { data } = await supabase
    .from("booking_doctor_days_off")
    .select("slug, days_off")
    .eq("slug", slug)
    .maybeSingle();
  return new Set<number>(((data as { days_off?: number[] } | null)?.days_off) || []);
}

interface ComboResult {
  slug: string;
  location: string;
  configured: boolean;
  candidateDates: number;
  bookableDates: number;
  totalOpenSlots: number;
  firstOpen?: string;
  daysOff: number[];
}

async function testCombo(slug: string, location: string): Promise<ComboResult> {
  const configured = Boolean(DOCTOR_AVAILABILITY[slug]?.[location]);
  const daysOffSet = await getDaysOff(slug);
  const result: ComboResult = {
    slug,
    location,
    configured,
    candidateDates: 0,
    bookableDates: 0,
    totalOpenSlots: 0,
    daysOff: Array.from(daysOffSet),
  };
  if (!configured) return result;

  const candidates = getCandidateDates(slug, location, 90).filter((d) => {
    const dow = getSwissDayOfWeek(d + "T12:00:00");
    return !daysOffSet.has(dow);
  });
  result.candidateDates = candidates.length;
  if (candidates.length === 0) return result;

  const doctorName = DOCTORS[slug];
  const providerId = await resolveProviderId(supabase, doctorName);

  const rangeStart = getSwissDayRange(candidates[0]).start;
  const rangeEnd = getSwissDayRange(candidates[candidates.length - 1]).end;
  const all = await fetchOverlappingAppointments(supabase, rangeStart, rangeEnd);
  const doctorAppts: AppointmentRow[] = all.filter((a) =>
    appointmentBelongsToDoctor(a, providerId, doctorName),
  );
  const maxCapacity = getMaxCapacity(slug);

  for (const date of candidates) {
    const slots = generateTimeSlots(slug, location, date);
    let dateHasOpen = false;
    for (const hhmm of slots) {
      const [h, m] = hhmm.split(":").map(Number);
      const slotStart = createSwissDateTime(date, h, m);
      const slotEnd = new Date(slotStart.getTime() + CONSULTATION_DURATION_MS);
      const blocking = doctorAppts.filter((a) => overlapsSlot(a, slotStart, slotEnd));
      if (blocking.length < maxCapacity) {
        result.totalOpenSlots += 1;
        dateHasOpen = true;
        if (!result.firstOpen) result.firstOpen = `${date} ${hhmm}`;
      }
    }
    if (dateHasOpen) result.bookableDates += 1;
  }
  return result;
}

async function main() {
  console.log("=== Comprehensive Booking Availability Test ===");
  console.log(`Run at: ${new Date().toISOString()}  (today Swiss: ${formatSwissYmd(getSwissToday())})`);
  console.log(`Window: next 90 days | capacity: 1 (2 for multi-capacity doctors)\n`);

  const results: ComboResult[] = [];
  for (const slug of Object.keys(DOCTORS)) {
    for (const location of LOCATIONS) {
      results.push(await testCombo(slug, location));
    }
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    pad("Doctor", 18) + pad("Location", 10) + pad("Config", 8) +
    pad("Dates", 7) + pad("Bookable", 10) + pad("OpenSlots", 11) + "FirstOpen",
  );
  console.log("-".repeat(86));
  for (const r of results) {
    const cfg = r.configured ? "yes" : "—";
    const line =
      pad(r.slug, 18) + pad(r.location, 10) + pad(cfg, 8) +
      pad(r.configured ? String(r.candidateDates) : "—", 7) +
      pad(r.configured ? String(r.bookableDates) : "—", 10) +
      pad(r.configured ? String(r.totalOpenSlots) : "—", 11) +
      (r.firstOpen || (r.configured ? "NONE" : ""));
    console.log(line);
  }

  console.log("\n=== Findings ===");
  const offered = results.filter((r) => r.configured);
  const broken = offered.filter((r) => r.bookableDates === 0);
  const daysOffNoted = results.filter((r) => r.daysOff.length > 0);
  console.log(`Configured doctor/location combos: ${offered.length}`);
  console.log(`Combos with NO bookable slot in 90 days: ${broken.length}`);
  for (const b of broken) {
    console.log(`  - ${b.slug} @ ${b.location}: ${b.candidateDates} candidate days, all fully blocked`);
  }
  if (daysOffNoted.length) {
    const seen = new Set<string>();
    for (const r of daysOffNoted) {
      if (seen.has(r.slug)) continue;
      seen.add(r.slug);
      console.log(`  days_off for ${r.slug}: [${r.daysOff.join(", ")}]`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
