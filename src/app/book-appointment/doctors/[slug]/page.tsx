"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

const DOCTORS: Record<string, {
  name: string;
  specialty: string;
  image: string;
  email: string;
  description: string;
}> = {
  "xavier-tenorio": {
    name: "Dr. Xavier Tenorio",
    specialty: "Chirurgien plasticien et esthétique",
    image: "/doctors/xavier-tenorio.jpg",
    email: "xavier@aesthetics-ge.ch",
    description: "Expert in facial rejuvenation and body contouring procedures with over 15 years of experience.",
  },
  "cesar-rodriguez": {
    name: "Dr. Cesar Rodriguez",
    specialty: "Aesthetic Medicine Specialist",
    image: "/doctors/cesar-rodriguez.jpg",
    email: "cesar@aesthetics-ge.ch",
    description: "Specialized in non-invasive aesthetic treatments and advanced skin care solutions.",
  },
  "yulia-raspertova": {
    name: "Dr. Yulia Raspertova",
    specialty: "Dermatology & Aesthetic Medicine",
    image: "/doctors/yulia-raspertova.jpg",
    email: "yulia@aesthetics-ge.ch",
    description: "Expert in dermatological treatments, anti-aging procedures, and skin health.",
  },
  "clinic": {
    name: "Laser & Treatments",
    specialty: "Aesthetics Clinic Services",
    image: "/doctors/clinic.png",
    email: "treatments@aesthetics-ge.ch",
    description: "Advanced laser treatments, body contouring, and aesthetic clinic services.",
  },
};

// Doctor availability by location
// Format: { [locationId]: { [dayOfWeek]: { start: "HH:MM", end: "HH:MM" } } }
// dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
const DOCTOR_AVAILABILITY: Record<string, Record<string, Record<number, { start: string; end: string }>>> = {
  "xavier-tenorio": {
    rhone: {
      1: { start: "14:00", end: "18:30" }, // Monday 2pm-6:30pm
      5: { start: "14:00", end: "18:30" }, // Friday 2pm-6:30pm
    },
    montreux: {
      4: { start: "10:00", end: "12:30" }, // Thursday 10am-12:30pm
    },
    gstaad: {
      6: { start: "16:00", end: "18:30" }, // Saturday 4pm-6:30pm
    },
  },
  "yulia-raspertova": {
    rhone: {
      1: { start: "10:00", end: "18:30" }, // Monday 10am-6:30pm
      2: { start: "10:00", end: "12:30" }, // Tuesday 10am-12:30pm
      4: { start: "10:00", end: "18:30" }, // Thursday 10am-6:30pm
      3: { start: "08:00", end: "12:00" }, // Wednesday 8am-12pm
      5: { start: "08:00", end: "12:00" }, // Friday 8am-12pm
    },
    champel: {
      2: { start: "14:00", end: "18:30" }, // Tuesday 2pm-6:30pm
    },
  },
  "cesar-rodriguez": {
    champel: {
      2: { start: "13:00", end: "17:00" }, // Tuesday 1pm-5pm
      5: { start: "13:00", end: "17:00" }, // Friday 1pm-5pm
    },
    rhone: {
      1: { start: "14:00", end: "18:30" }, // Monday 2pm-6:30pm
      5: { start: "14:00", end: "18:30" }, // Friday 2pm-6:30pm
    },
    montreux: {
      3: { start: "15:00", end: "17:00" }, // Wednesday 3pm-5pm
    },
  },
  "clinic": {
    champel: {
      1: { start: "10:00", end: "18:30" }, // Monday 10am-6:30pm
      2: { start: "10:00", end: "12:00" }, // Tuesday 10am-12pm
      3: { start: "10:00", end: "12:00" }, // Wednesday 10am-12pm
      4: { start: "10:00", end: "12:00" }, // Thursday 10am-12pm
      5: { start: "10:00", end: "12:00" }, // Friday 10am-12pm
      6: { start: "10:00", end: "12:00" }, // Saturday 10am-12pm
    },
  },
};

const LOCATION_NAMES: Record<string, string> = {
  rhone: "Rhône",
  champel: "Champel",
  gstaad: "Gstaad",
  montreux: "Montreux",
};

const LOCATION_LABELS: Record<string, string> = {
  rhone: "Genève - Rue du Rhône",
  champel: "Genève - Champel",
  gstaad: "Gstaad",
  montreux: "Montreux",
};

// Generate 30-minute time slots based on doctor availability for a specific date
function generateTimeSlots(doctorSlug: string, locationId: string, date: Date): string[] {
  const dayOfWeek = date.getDay();
  const availability = DOCTOR_AVAILABILITY[doctorSlug]?.[locationId]?.[dayOfWeek];
  
  if (!availability) {
    return [];
  }

  const slots: string[] = [];
  const [startHour, startMin] = availability.start.split(":").map(Number);
  const [endHour, endMin] = availability.end.split(":").map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  // Generate 30-minute slots until we reach the end time
  // The last slot should start at least 30 minutes before end time
  while (
    currentHour < endHour || 
    (currentHour === endHour && currentMin < endMin)
  ) {
    const slotTime = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;
    slots.push(slotTime);
    
    // Move to next 30-minute slot
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin = 0;
      currentHour += 1;
    }
  }
  
  return slots;
}

// Check if a date has available slots for the doctor at the location
function hasAvailabilityOnDate(doctorSlug: string, locationId: string, date: Date): boolean {
  const dayOfWeek = date.getDay();
  const availability = DOCTOR_AVAILABILITY[doctorSlug]?.[locationId]?.[dayOfWeek];
  return !!availability;
}

// Find the nearest available date for the doctor at the location
function findNearestAvailableDate(doctorSlug: string, locationId: string, maxDaysAhead: number = 90): Date | null {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < maxDaysAhead; i++) {
    const checkDate = new Date(tomorrow);
    checkDate.setDate(tomorrow.getDate() + i);
    if (hasAvailabilityOnDate(doctorSlug, locationId, checkDate)) {
      return checkDate;
    }
  }
  return null;
}

// Get all available dates for the doctor at the location within a range
function getAvailableDates(doctorSlug: string, locationId: string, maxDaysAhead: number = 90): string[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const availableDates: string[] = [];
  for (let i = 0; i < maxDaysAhead; i++) {
    const checkDate = new Date(tomorrow);
    checkDate.setDate(tomorrow.getDate() + i);
    if (hasAvailabilityOnDate(doctorSlug, locationId, checkDate)) {
      availableDates.push(checkDate.toISOString().split('T')[0]);
    }
  }
  return availableDates;
}

type BookingStep = "info" | "datetime" | "confirm";

function DoctorBookingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const doctor = DOCTORS[slug];
  
  // Get location from query params (set during location selection)
  const locationId = searchParams.get("location") || "";
  const locationName = LOCATION_NAMES[locationId] || locationId;
  const locationLabel = LOCATION_LABELS[locationId] || locationId;

  const [step, setStep] = useState<BookingStep>("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Form state - pre-fill from query params if available (magic link support)
  const [firstName, setFirstName] = useState(searchParams.get("firstName") || "");
  const [lastName, setLastName] = useState(searchParams.get("lastName") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDatesSet, setAvailableDatesSet] = useState<Set<string>>(new Set());
  const [nearestAvailableDate, setNearestAvailableDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");

  // Fixed service - all appointments are general consultations
  const selectedService = "General Consultation";

  // Autofill from patient data if coming from intake form
  const patientId = searchParams.get("pid");
  const autofill = searchParams.get("autofill");

  useEffect(() => {
    if (autofill === "true" && patientId) {
      const fetchPatientData = async () => {
        try {
          const { data: patient } = await supabaseClient
            .from("patients")
            .select("first_name, last_name, email, phone")
            .eq("id", patientId)
            .single();

          if (patient) {
            setFirstName(patient.first_name || "");
            setLastName(patient.last_name || "");
            setEmail(patient.email || "");
            setPhone(patient.phone || "");
          }
        } catch (err) {
          console.error("Error fetching patient data for autofill:", err);
        }
      };
      fetchPatientData();
    }
  }, [autofill, patientId]);

  // Calculate available dates and nearest date when location changes
  useEffect(() => {
    if (locationId && slug) {
      const dates = getAvailableDates(slug, locationId, 90);
      setAvailableDatesSet(new Set(dates));
      
      const nearest = findNearestAvailableDate(slug, locationId, 90);
      if (nearest) {
        const nearestStr = nearest.toISOString().split('T')[0];
        setNearestAvailableDate(nearestStr);
        // Auto-select the nearest available date if no date selected yet
        if (!selectedDate) {
          setSelectedDate(nearestStr);
        }
      } else {
        setNearestAvailableDate(null);
      }
    }
  }, [locationId, slug]);

  // Generate time slots and check availability when date changes
  useEffect(() => {
    if (selectedDate && locationId) {
      const date = new Date(selectedDate);
      const slots = generateTimeSlots(slug, locationId, date);
      setAvailableSlots(slots);
      setSelectedTime(""); // Reset selected time when date changes
      checkAvailability(selectedDate);
    } else {
      setAvailableSlots([]);
    }
  }, [selectedDate, locationId, slug]);

  async function checkAvailability(date: string) {
    try {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      // Pass doctor name to filter availability by specific doctor
      const doctorNameParam = encodeURIComponent(doctor?.name || "");
      const res = await fetch(
        `/api/appointments/check-availability?start=${start.toISOString()}&end=${end.toISOString()}&doctor=${doctorNameParam}`
      );
      const data = await res.json();

      if (data.appointments) {
        const slots = data.appointments.map((apt: { start_time: string }) => {
          const time = new Date(apt.start_time);
          return `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
        });
        setBookedSlots(slots);
      }
    } catch (err) {
      console.error("Error checking availability:", err);
    }
  }

  async function handleSubmit() {
    if (!firstName || !lastName || !email || !selectedDate || !selectedTime || !locationId) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/public/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          appointmentDate: `${selectedDate}T${selectedTime}:00`,
          service: selectedService,
          doctorSlug: slug,
          doctorName: doctor.name,
          doctorEmail: doctor.email,
          notes,
          location: locationName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to book appointment");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book appointment");
    } finally {
      setLoading(false);
    }
  }

  if (!doctor) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Doctor Not Found</h1>
          <Link href="/book-appointment/doctors" className="text-slate-900 hover:underline">
            Back to Doctors
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-200">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Appointment Booked!</h1>
          <p className="text-slate-600 mb-6">
            Your appointment with <strong>{doctor.name}</strong> has been confirmed. 
            A confirmation email has been sent to <strong>{email}</strong>.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-slate-600 mb-2">
              <strong>Date:</strong> {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-sm text-slate-600 mb-2">
              <strong>Time:</strong> {selectedTime}
            </p>
            <p className="text-sm text-slate-600">
              <strong>Service:</strong> {selectedService}
            </p>
          </div>
          <Link
            href="/book-appointment"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full font-medium hover:bg-slate-800 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split("T")[0];
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-slate-200 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-200 rounded-full opacity-50 blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* Logo Header */}
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/book-appointment">
            <Image
              src="/logos/aesthetics-logo.svg"
              alt="Aesthetics Clinic"
              width={280}
              height={80}
              className="h-12 sm:h-14 md:h-16 w-auto mx-auto"
              priority
            />
          </Link>
        </div>

        {/* Back Link */}
        <Link
          href={`/book-appointment/doctors?location=${locationId}`}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 sm:mb-8 transition-colors text-sm sm:text-base"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Specialists
        </Link>

        {/* Location Badge */}
        <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 mb-6">
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium text-slate-700">{locationLabel}</span>
        </div>

        <div className="grid lg:grid-cols-[200px_1fr] gap-4 sm:gap-6 lg:gap-8">
          {/* Doctor Card - Fixed (smaller) */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden border border-slate-200 flex lg:flex-col">
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-full lg:h-40 bg-gradient-to-br from-slate-100 to-slate-50 flex-shrink-0">
                <Image
                  src={doctor.image}
                  alt={doctor.name}
                  fill
                  className="object-cover object-top"
                />
              </div>
              <div className="p-3 sm:p-4 flex-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-0.5 sm:mb-1">{doctor.name}</h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mb-1 sm:mb-2">{doctor.specialty}</p>
                <p className="text-xs sm:text-sm text-slate-600 hidden sm:block line-clamp-2">{doctor.description}</p>
              </div>
            </div>
          </div>

          {/* Booking Form */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 border border-slate-200">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">Book an Appointment</h1>

            {/* Progress Steps */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2">
              {(["info", "datetime", "confirm"] as BookingStep[]).map((s, idx) => (
                <button
                  key={s}
                  onClick={() => {
                    if (s === "info" || (s === "datetime" && firstName && lastName && email) || 
                        (s === "confirm" && selectedDate && selectedTime)) {
                      setStep(s);
                    }
                  }}
                  className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    step === s
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] sm:text-xs">
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline">
                    {s === "info" && "Personal Info"}
                    {s === "datetime" && "Date & Time"}
                    {s === "confirm" && "Confirm"}
                  </span>
                  <span className="sm:hidden">
                    {s === "info" && "Info"}
                    {s === "datetime" && "Date"}
                    {s === "confirm" && "Confirm"}
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Step 1: Personal Information */}
            {step === "info" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                  />
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => {
                      if (firstName && lastName && email) {
                        setStep("datetime");
                        setError(null);
                      } else {
                        setError("Please fill in all required fields");
                      }
                    }}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === "datetime" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Date & Time</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Please select a date when {doctor.name} is available at {locationLabel}.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      // Only allow dates with availability
                      if (availableDatesSet.has(newDate) || !newDate) {
                        setSelectedDate(newDate);
                        setSelectedTime("");
                      } else {
                        // If user selects unavailable date, show it but warn them
                        setSelectedDate(newDate);
                        setSelectedTime("");
                      }
                    }}
                    min={getMinDate()}
                    max={getMaxDate()}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                  />
                  {nearestAvailableDate && !selectedDate && (
                    <p className="mt-2 text-xs text-slate-500">
                      Next available date: {new Date(nearestAvailableDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                  {availableDatesSet.size > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      {availableDatesSet.size} available dates in the next 3 months
                    </p>
                  )}
                </div>

                {selectedDate && availableSlots.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Available Time Slots *</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots.map((time: string) => {
                        const isBooked = bookedSlots.includes(time);
                        return (
                          <button
                            key={time}
                            onClick={() => !isBooked && setSelectedTime(time)}
                            disabled={isBooked}
                            className={`py-3 rounded-xl text-sm font-medium transition-all ${
                              isBooked
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed line-through"
                                : selectedTime === time
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedDate && availableSlots.length === 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <p className="text-sm text-amber-700 font-medium">
                      {doctor.name} is fully booked at {locationLabel} on this day. Please select another date.
                    </p>
                    <p className="text-sm text-amber-600 italic">
                      Le {doctor.name.replace('Dr. ', 'Dr ')} est complet à {locationLabel} à cette date. Veuillez choisir une autre date.
                    </p>
                    {nearestAvailableDate && nearestAvailableDate !== selectedDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedDate(nearestAvailableDate)}
                        className="mt-2 text-sm text-sky-700 hover:text-sky-800 underline font-medium"
                      >
                        → Next available: {new Date(nearestAvailableDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Additional Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all resize-none"
                    placeholder="Any specific concerns or requests..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setStep("info")}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (selectedDate && selectedTime) {
                        setStep("confirm");
                        setError(null);
                      } else {
                        setError("Please select a date and time");
                      }
                    }}
                    className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === "confirm" && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Confirm Your Appointment</h3>
                
                <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name</span>
                    <span className="font-medium text-slate-900">{firstName} {lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email</span>
                    <span className="font-medium text-slate-900">{email}</span>
                  </div>
                  {phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Phone</span>
                      <span className="font-medium text-slate-900">{phone}</span>
                    </div>
                  )}
                  <hr className="border-slate-200" />
                  <div className="flex justify-between">
                    <span className="text-slate-600">Doctor</span>
                    <span className="font-medium text-slate-900">{doctor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date</span>
                    <span className="font-medium text-slate-900">
                      {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Time</span>
                    <span className="font-medium text-slate-900">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Service</span>
                    <span className="font-medium text-slate-900">{selectedService}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Location</span>
                    <span className="font-medium text-slate-900">{locationLabel}</span>
                  </div>
                  {notes && (
                    <>
                      <hr className="border-slate-200" />
                      <div>
                        <span className="text-slate-600 block mb-1">Notes</span>
                        <span className="text-sm text-slate-900">{notes}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("datetime")}
                    disabled={loading}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Booking...
                      </>
                    ) : (
                      "Confirm Booking"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} Aesthetics Clinic. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

export default function DoctorBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    }>
      <DoctorBookingContent />
    </Suspense>
  );
}
