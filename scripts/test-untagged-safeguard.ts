/**
 * Regression test for the "untagged appointment" availability safeguard.
 * Run: npx tsx scripts/test-untagged-safeguard.ts
 *
 * Locks in Caveat-2 behaviour: an appointment with no provider_id and no
 * [Doctor: <name>] tag must block online slots (location-scoped), while an
 * appointment attributed to a DIFFERENT doctor must not.
 */
import {
  appointmentOccupiesDoctorSlot,
  getBlockingAppointments,
  isUnattributed,
  normalizeBookingLocation,
  type AppointmentRow,
} from "../src/lib/appointmentAvailability";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ok   - ${name}`); }
  else { failed++; console.error(`  FAIL - ${name}`); }
}

const slotStart = new Date("2026-07-01T12:00:00.000Z");
const slotEnd = new Date("2026-07-01T12:30:00.000Z");
const base = { start_time: slotStart.toISOString(), end_time: slotEnd.toISOString() };
const YULIA = "Dr. Yulia Raspertova";
const YULIA_PID = "prov-yulia";

console.log("normalizeBookingLocation:");
check("rhone slug -> rhone", normalizeBookingLocation("rhone") === "rhone");
check("Rhône label -> rhone", normalizeBookingLocation("Genève - Rue du Rhône") === "rhone");
check("Champel label -> champel", normalizeBookingLocation("Genève - Champel") === "champel");
check("Champel display -> champel", normalizeBookingLocation("Champel") === "champel");
check("Gstaad -> gstaad", normalizeBookingLocation("Gstaad") === "gstaad");
check("Montreux -> montreux", normalizeBookingLocation("Montreux") === "montreux");
check("bare Geneva -> null (ambiguous)", normalizeBookingLocation("Geneva") === null);
check("null -> null", normalizeBookingLocation(null) === null);
check("unknown -> null", normalizeBookingLocation("Zurich Clinic") === null);

console.log("\nisUnattributed:");
check("no pid + no tag -> true", isUnattributed({ ...base, id: "1", reason: "PAUSE break" }) === true);
check("has pid -> false", isUnattributed({ ...base, id: "2", provider_id: YULIA_PID }) === true ? false : true);
check("has [Doctor:] tag -> false", isUnattributed({ ...base, id: "3", reason: "X [Doctor: Yulia Raspertova]" }) === false);

console.log("\nappointmentOccupiesDoctorSlot (the safeguard):");
const opts = { providerId: YULIA_PID, doctorName: YULIA };

const taggedYulia: AppointmentRow = { ...base, id: "a", reason: "Botox [Doctor: Yulia Raspertova]" };
check("tagged to this doctor -> blocks", appointmentOccupiesDoctorSlot(taggedYulia, opts) === true);

const providerYulia: AppointmentRow = { ...base, id: "b", provider_id: YULIA_PID };
check("provider_id match -> blocks", appointmentOccupiesDoctorSlot(providerYulia, opts) === true);

const taggedOther: AppointmentRow = { ...base, id: "c", reason: "Consult [Doctor: Xavier Tenorio]" };
check("tagged to a DIFFERENT doctor -> does NOT block", appointmentOccupiesDoctorSlot(taggedOther, opts) === false);

const providerOther: AppointmentRow = { ...base, id: "d", provider_id: "prov-xavier" };
check("provider_id of different doctor -> does NOT block", appointmentOccupiesDoctorSlot(providerOther, opts) === false);

const untaggedNoLoc: AppointmentRow = { ...base, id: "e", reason: "PAUSE", no_patient: true };
check("untagged + no location -> blocks (conservative)", appointmentOccupiesDoctorSlot(untaggedNoLoc, { ...opts, bookingLocation: "champel" }) === true);

const untaggedSameLoc: AppointmentRow = { ...base, id: "f", reason: "Blocked", location: "Champel" };
check("untagged + same location -> blocks", appointmentOccupiesDoctorSlot(untaggedSameLoc, { ...opts, bookingLocation: "champel" }) === true);

const untaggedDiffLoc: AppointmentRow = { ...base, id: "g", reason: "Blocked", location: "Gstaad" };
check("untagged + DIFFERENT known location -> does NOT block", appointmentOccupiesDoctorSlot(untaggedDiffLoc, { ...opts, bookingLocation: "champel" }) === false);

const untaggedGeneva: AppointmentRow = { ...base, id: "h", reason: "Blocked", location: "Geneva" };
check("untagged + ambiguous Geneva -> blocks (covers Rhône+Champel)", appointmentOccupiesDoctorSlot(untaggedGeneva, { ...opts, bookingLocation: "champel" }) === true);

const untaggedNoBookLoc: AppointmentRow = { ...base, id: "i", reason: "Blocked", location: "Gstaad" };
check("untagged diff-loc but booking location unknown -> blocks", appointmentOccupiesDoctorSlot(untaggedNoBookLoc, { ...opts, bookingLocation: null }) === true);

console.log("\ngetBlockingAppointments (occupies AND overlaps):");
const nonOverlapping: AppointmentRow = {
  id: "j", reason: "PAUSE",
  start_time: "2026-07-01T13:00:00.000Z", end_time: "2026-07-01T13:30:00.000Z",
};
const pool = [untaggedNoLoc, taggedOther, nonOverlapping];
const blocking = getBlockingAppointments(pool, { providerId: YULIA_PID, doctorName: YULIA, bookingLocation: "champel", slotStart, slotEnd });
check("untagged overlapping counted", blocking.some((a) => a.id === "e"));
check("different-doctor NOT counted", !blocking.some((a) => a.id === "c"));
check("non-overlapping untagged NOT counted", !blocking.some((a) => a.id === "j"));
check("exactly 1 blocking", blocking.length === 1);

console.log(`\n${failed === 0 ? "PASS" : "FAIL"}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
