"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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

const SERVICE_OPTIONS = [
  "Free Consultation",
  "3D Simulation",
  "Facial Rejuvenation",
  "Body Contouring",
  "Laser Treatment",
  "Skin Care",
  "Anti-Aging",
  "Other",
];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

type BookingStep = "info" | "datetime" | "service" | "confirm";

export default function DoctorBookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const doctor = DOCTORS[slug];

  const [step, setStep] = useState<BookingStep>("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [notes, setNotes] = useState("");

  // Check availability when date changes
  useEffect(() => {
    if (selectedDate) {
      checkAvailability(selectedDate);
    }
  }, [selectedDate]);

  async function checkAvailability(date: string) {
    try {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const res = await fetch(
        `/api/appointments/check-availability?start=${start.toISOString()}&end=${end.toISOString()}`
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
    if (!firstName || !lastName || !email || !selectedDate || !selectedTime || !selectedService) {
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
          location: "Geneva",
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
          href="/book-appointment/doctors"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 sm:mb-8 transition-colors text-sm sm:text-base"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Doctors
        </Link>

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
              {(["info", "datetime", "service", "confirm"] as BookingStep[]).map((s, idx) => (
                <button
                  key={s}
                  onClick={() => {
                    if (s === "info" || (s === "datetime" && firstName && lastName && email) || 
                        (s === "service" && selectedDate && selectedTime) || 
                        (s === "confirm" && selectedService)) {
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
                    {s === "service" && "Service"}
                    {s === "confirm" && "Confirm"}
                  </span>
                  <span className="sm:hidden">
                    {s === "info" && "Info"}
                    {s === "datetime" && "Date"}
                    {s === "service" && "Service"}
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
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                      placeholder="Doe"
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
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                    placeholder="+41 XX XXX XX XX"
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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTime("");
                    }}
                    min={getMinDate()}
                    max={getMaxDate()}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                  />
                </div>

                {selectedDate && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Available Time Slots *</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {TIME_SLOTS.map((time) => {
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
                        setStep("service");
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

            {/* Step 3: Service Selection */}
            {step === "service" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Service</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {SERVICE_OPTIONS.map((service) => (
                    <button
                      key={service}
                      onClick={() => setSelectedService(service)}
                      className={`p-4 rounded-xl text-left transition-all border-2 ${
                        selectedService === service
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className={`font-medium ${selectedService === service ? "text-slate-900" : "text-slate-900"}`}>
                        {service}
                      </span>
                    </button>
                  ))}
                </div>

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
                    onClick={() => setStep("datetime")}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (selectedService) {
                        setStep("confirm");
                        setError(null);
                      } else {
                        setError("Please select a service");
                      }
                    }}
                    className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Confirmation */}
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
                    onClick={() => setStep("service")}
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
