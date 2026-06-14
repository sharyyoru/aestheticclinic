"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, MapPin, Check, Loader2, Calendar as CalendarIcon, Clock } from "lucide-react";
import {
  getSwissToday,
  formatSwissYmd,
  parseSwissDate,
  getSwissDayOfWeek,
  createSwissDateTime,
  getSwissDayRange,
  getSwissSlotString,
} from "@/lib/swissTimezone";

type PatientInfo = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type Doctor = { slug: string; name: string; specialty: string; email: string };

const DOCTORS: Record<string, Doctor> = {
  "xavier-tenorio": { slug: "xavier-tenorio", name: "Dr. Xavier Tenorio", specialty: "Plastic & Aesthetic Surgeon", email: "xavier@aesthetics-ge.ch" },
  "cesar-rodriguez": { slug: "cesar-rodriguez", name: "Dr. Cesar Rodriguez", specialty: "Plastic Surgery Expert", email: "cesar@aesthetics-ge.ch" },
  "yulia-raspertova": { slug: "yulia-raspertova", name: "Dr. Yulia Raspertova", specialty: "Dermatology & Aesthetic Medicine", email: "yulia@aesthetics-ge.ch" },
  "clinic": { slug: "clinic", name: "Laser & Treatments", specialty: "Aesthetics Clinic Services", email: "treatments@aesthetics-ge.ch" },
  "lily-radionova": { slug: "lily-radionova", name: "Nurse Lily Radionova", specialty: "Aesthetic Nurse Specialist", email: "lily@aesthetics-ge.ch" },
};

const DOCTOR_AVAILABILITY: Record<string, Record<string, Record<number, { start: string; end: string }>>> = {
  "xavier-tenorio": {
    rhone: { 1: { start: "14:00", end: "18:30" }, 5: { start: "14:00", end: "18:30" } },
    montreux: { 4: { start: "10:00", end: "12:30" } },
    gstaad: { 6: { start: "16:00", end: "18:30" } },
  },
  "yulia-raspertova": {
    rhone: { 1: { start: "10:00", end: "18:30" }, 2: { start: "10:00", end: "12:30" }, 4: { start: "10:00", end: "18:30" }, 3: { start: "08:00", end: "12:00" }, 5: { start: "08:00", end: "12:00" } },
    champel: { 2: { start: "14:00", end: "18:30" } },
  },
  "cesar-rodriguez": {
    champel: { 2: { start: "13:00", end: "17:00" }, 5: { start: "13:00", end: "17:00" } },
    rhone: { 1: { start: "14:00", end: "18:30" }, 5: { start: "14:00", end: "18:30" } },
    montreux: { 3: { start: "15:00", end: "17:00" } },
  },
  "clinic": {
    champel: { 1: { start: "10:00", end: "18:30" }, 2: { start: "10:00", end: "12:00" }, 3: { start: "10:00", end: "12:00" }, 4: { start: "10:00", end: "12:00" }, 5: { start: "10:00", end: "12:00" }, 6: { start: "10:00", end: "12:00" } },
  },
  "lily-radionova": {
    gstaad: { 1: { start: "10:00", end: "18:30" }, 2: { start: "10:00", end: "18:30" }, 3: { start: "10:00", end: "18:30" }, 4: { start: "10:00", end: "18:30" }, 5: { start: "10:00", end: "18:30" }, 6: { start: "10:00", end: "18:30" } },
  },
};

const LOCATIONS: { id: string; name: string; label: string }[] = [
  { id: "rhone", name: "Rhône", label: "Genève - Rue du Rhône" },
  { id: "champel", name: "Champel", label: "Genève - Champel" },
  { id: "gstaad", name: "Gstaad", label: "Gstaad" },
  { id: "montreux", name: "Montreux", label: "Montreux" },
];

const LOCATION_NAMES: Record<string, string> = {
  rhone: "Rhône",
  champel: "Champel",
  gstaad: "Gstaad",
  montreux: "Montreux",
};

function generateTimeSlots(doctorSlug: string, locationId: string, dateStr: string): string[] {
  const date = parseSwissDate(dateStr);
  const dayOfWeek = date.getDay();
  const availability = DOCTOR_AVAILABILITY[doctorSlug]?.[locationId]?.[dayOfWeek];
  if (!availability) return [];

  const slots: string[] = [];
  const [startHour, startMin] = availability.start.split(":").map(Number);
  const [endHour, endMin] = availability.end.split(":").map(Number);
  let h = startHour;
  let m = startMin;
  while (h < endHour || (h === endHour && m < endMin)) {
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    m += 30;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
  }
  return slots;
}

function getAvailableDates(doctorSlug: string, locationId: string, maxDaysAhead = 90): string[] {
  const today = getSwissToday();
  const dates: string[] = [];
  for (let i = 1; i <= maxDaysAhead; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const dow = getSwissDayOfWeek(checkDate);
    if (DOCTOR_AVAILABILITY[doctorSlug]?.[locationId]?.[dow]) {
      dates.push(formatSwissYmd(checkDate));
    }
  }
  return dates;
}

function doctorsForLocation(locationId: string): Doctor[] {
  return Object.values(DOCTORS).filter((d) => DOCTOR_AVAILABILITY[d.slug]?.[locationId]);
}

function formatDateLabel(dateStr: string): string {
  const d = parseSwissDate(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

type Step = "location" | "doctor" | "datetime" | "confirm" | "success";

export default function BookingFlow({
  patient,
  onClose,
  onBooked,
}: {
  patient: PatientInfo;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [step, setStep] = useState<Step>("location");
  const [locationId, setLocationId] = useState("");
  const [doctorSlug, setDoctorSlug] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doctor = doctorSlug ? DOCTORS[doctorSlug] : null;

  // When doctor + location chosen, compute available dates
  useEffect(() => {
    if (locationId && doctorSlug) {
      const dates = getAvailableDates(doctorSlug, locationId);
      setAvailableDates(dates);
      if (dates.length > 0) setSelectedDate(dates[0]);
    }
  }, [locationId, doctorSlug]);

  const checkAvailability = useCallback(
    async (date: string) => {
      if (!doctor) return;
      try {
        const { start, end } = getSwissDayRange(date);
        const res = await fetch(
          `/api/appointments/check-availability?start=${start}&end=${end}&doctor=${encodeURIComponent(doctor.name)}&slug=${doctorSlug}`,
        );
        const data = await res.json();
        let blocked: string[] = [];
        if (data.fullSlots) {
          blocked = data.fullSlots.map((iso: string) => getSwissSlotString(new Date(iso)));
        }
        setBookedSlots(blocked);
        const open = generateTimeSlots(doctorSlug, locationId, date).filter((t) => !blocked.includes(t));
        setSelectedTime(open[0] || "");
      } catch {
        setBookedSlots([]);
      }
    },
    [doctor, doctorSlug, locationId],
  );

  // When date chosen, compute slots + availability
  useEffect(() => {
    if (selectedDate && locationId && doctorSlug) {
      setSlots(generateTimeSlots(doctorSlug, locationId, selectedDate));
      checkAvailability(selectedDate);
    }
  }, [selectedDate, locationId, doctorSlug, checkAvailability]);

  async function handleConfirm() {
    if (!doctor || !selectedDate || !selectedTime) {
      setError("Please select a date and time");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [hour, minute] = selectedTime.split(":").map(Number);
      const appointmentDate = createSwissDateTime(selectedDate, hour, minute);
      const res = await fetch("/api/public/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: patient.first_name || "",
          lastName: patient.last_name || "",
          email: patient.email || "",
          phone: patient.phone || "",
          appointmentDate: appointmentDate.toISOString(),
          service: "General Consultation",
          doctorSlug: doctor.slug,
          doctorName: doctor.name,
          doctorEmail: doctor.email,
          notes,
          location: LOCATION_NAMES[locationId] || locationId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to book appointment");
      setStep("success");
      onBooked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book appointment");
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setError(null);
    if (step === "doctor") setStep("location");
    else if (step === "datetime") setStep("doctor");
    else if (step === "confirm") setStep("datetime");
  }

  const stepTitle =
    step === "location"
      ? "Choose Location"
      : step === "doctor"
      ? "Choose Specialist"
      : step === "datetime"
      ? "Pick Date & Time"
      : step === "confirm"
      ? "Confirm Booking"
      : "Booked";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <div className="bg-white" style={{ paddingTop: "env(safe-area-inset-top)" }} />

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-2 flex-shrink-0">
        {step !== "location" && step !== "success" ? (
          <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-100">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        ) : (
          <div className="w-8" />
        )}
        <h1 className="flex-1 text-center font-semibold text-slate-900">{stepTitle}</h1>
        <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg active:bg-slate-100">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain p-5">
        {/* LOCATION */}
        {step === "location" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Select your preferred clinic location.</p>
            {LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                onClick={() => {
                  setLocationId(loc.id);
                  setDoctorSlug("");
                  setStep("doctor");
                }}
                className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3 text-left active:bg-slate-50"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-sky-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{loc.name}</p>
                  <p className="text-xs text-slate-500 truncate">{loc.label}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* DOCTOR */}
        {step === "doctor" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Available specialists at {LOCATION_NAMES[locationId]}.</p>
            {doctorsForLocation(locationId).map((d) => (
              <button
                key={d.slug}
                onClick={() => {
                  setDoctorSlug(d.slug);
                  setStep("datetime");
                }}
                className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3 text-left active:bg-slate-50"
              >
                <div className="w-11 h-11 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-semibold flex-shrink-0">
                  {d.name.split(" ").slice(-1)[0][0]}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-500 truncate">{d.specialty}</p>
                </div>
              </button>
            ))}
            {doctorsForLocation(locationId).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No specialists available at this location.</p>
            )}
          </div>
        )}

        {/* DATE & TIME */}
        {step === "datetime" && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-sky-500" /> Select a date
              </h2>
              {availableDates.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">No available dates in the next 90 days.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {availableDates.slice(0, 30).map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDate(d)}
                      className={`flex-shrink-0 px-3 py-2.5 rounded-xl border text-center transition-colors ${
                        selectedDate === d
                          ? "bg-sky-500 border-sky-500 text-white"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className="block text-xs font-medium whitespace-nowrap">{formatDateLabel(d)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedDate && (
              <div>
                <h2 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-500" /> Select a time
                </h2>
                {slots.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">No time slots for this date.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((t) => {
                      const isBooked = bookedSlots.includes(t);
                      return (
                        <button
                          key={t}
                          disabled={isBooked}
                          onClick={() => setSelectedTime(t)}
                          className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                            isBooked
                              ? "bg-slate-50 border-slate-100 text-slate-300 line-through"
                              : selectedTime === t
                              ? "bg-sky-500 border-sky-500 text-white"
                              : "bg-white border-slate-200 text-slate-700"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div>
              <h2 className="font-semibold text-slate-900 text-sm mb-2">Notes (optional)</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything you'd like us to know?"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <button
              onClick={() => setStep("confirm")}
              disabled={!selectedDate || !selectedTime}
              className="w-full py-3.5 bg-sky-500 text-white rounded-2xl font-semibold shadow-lg shadow-sky-500/25 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {/* CONFIRM */}
        {step === "confirm" && doctor && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
              <ConfirmRow label="Patient" value={`${patient.first_name || ""} ${patient.last_name || ""}`.trim()} />
              <ConfirmRow label="Specialist" value={doctor.name} />
              <ConfirmRow label="Location" value={LOCATION_NAMES[locationId]} />
              <ConfirmRow label="Date" value={formatDateLabel(selectedDate)} />
              <ConfirmRow label="Time" value={selectedTime} />
              {notes && <ConfirmRow label="Notes" value={notes} />}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-3.5 bg-sky-500 text-white rounded-2xl font-semibold shadow-lg shadow-sky-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Appointment"}
            </button>
            <p className="text-xs text-slate-400 text-center">
              You&apos;ll receive a confirmation email once booked.
            </p>
          </div>
        )}

        {/* SUCCESS */}
        {step === "success" && doctor && (
          <div className="flex flex-col items-center justify-center text-center pt-16 px-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Appointment Booked!</h2>
            <p className="text-sm text-slate-500 mb-6">
              {formatDateLabel(selectedDate)} at {selectedTime} with {doctor.name} ({LOCATION_NAMES[locationId]}).
              A confirmation has been sent to your email.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-sky-500 text-white rounded-2xl font-semibold shadow-lg shadow-sky-500/25"
            >
              Done
            </button>
          </div>
        )}
      </main>
      <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}
