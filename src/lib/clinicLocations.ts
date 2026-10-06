import { normalizeBookingLocation } from "@/lib/appointmentAvailability";

/**
 * SINGLE SOURCE OF TRUTH for the clinic's street addresses per site.
 * Appointment `location` values are free text ("Rhône", "Champel",
 * "Genève - Rue du Rhône", "Geneva", ...), so resolution goes through
 * normalizeBookingLocation() from appointmentAvailability.ts.
 * Addresses match the footer block already printed in patient emails
 * (src/app/appointments/page.tsx).
 */
export type ClinicLocationKey = "rhone" | "champel" | "gstaad" | "montreux";

export const CLINIC_LOCATIONS: Record<ClinicLocationKey, { name: string; address: string }> = {
  rhone: { name: "Rhône", address: "Rue du Rhône 17, 1204 Genève (3ème étage)" },
  champel: { name: "Champel", address: "Chemin Rieu 18, 1208 Genève" },
  gstaad: { name: "Gstaad", address: "Alpinastrasse 23, 3780 Gstaad" },
  montreux: { name: "Montreux", address: "Avenue Claude Nobs 2, 1820 Montreux" },
};

// The flagship Geneva site — also the general clinic address given out by
// other patient-facing channels (e.g. the Retell webhook).
export const DEFAULT_CLINIC_ADDRESS = CLINIC_LOCATIONS.rhone.address;

/**
 * Resolve the street address for an appointment `location` value. Unknown or
 * ambiguous values (including a bare "Geneva") fall back to the flagship
 * Rhône address so every patient email carries an exact address.
 */
export function clinicAddressForLocation(location?: string | null): string {
  const key = normalizeBookingLocation(location) as ClinicLocationKey | null;
  return key ? CLINIC_LOCATIONS[key].address : DEFAULT_CLINIC_ADDRESS;
}
