"use client";

import Image from "next/image";
import Link from "next/link";

const DOCTORS = [
  {
    slug: "xavier-tenorio",
    name: "Dr. Xavier Tenorio",
    specialty: "Chirurgien plasticien et esthétique",
    image: "/doctors/xavier-tenorio.jpg",
    description: "Expert in facial rejuvenation and body contouring procedures.",
  },
  {
    slug: "cesar-rodriguez",
    name: "Dr. Cesar Rodriguez",
    specialty: "Aesthetic Medicine Specialist",
    image: "/doctors/cesar-rodriguez.jpg",
    description: "Specialized in non-invasive aesthetic treatments and skin care.",
  },
  {
    slug: "yulia-raspertova",
    name: "Dr. Yulia Raspertova",
    specialty: "Dermatology & Aesthetic Medicine",
    image: "/doctors/yulia-raspertova.jpg",
    description: "Expert in dermatological treatments and anti-aging procedures.",
  },
  {
    slug: "clinic",
    name: "Laser & Treatments",
    specialty: "Aesthetics Clinic Services",
    image: "/doctors/clinic.png",
    description: "Advanced laser treatments and aesthetic clinic services.",
  },
];

export default function DoctorsListPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-slate-200 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-200 rounded-full opacity-50 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
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
          href="/book-appointment"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 sm:mb-8 transition-colors text-sm sm:text-base"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 sm:mb-4">
            Choose Your Specialist
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto px-4">
            Select a doctor or service to book your appointment
          </p>
        </div>

        {/* Doctors Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {DOCTORS.map((doctor) => (
            <Link
              key={doctor.slug}
              href={`/book-appointment/doctors/${doctor.slug}`}
              className="group bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-400 transition-all transform hover:-translate-y-1"
            >
              <div className="relative h-28 sm:h-36 md:h-40 bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden">
                <Image
                  src={doctor.image}
                  alt={doctor.name}
                  fill
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 sm:p-4 md:p-5">
                <h2 className="text-sm sm:text-base md:text-lg font-semibold text-slate-900 mb-0.5 sm:mb-1 group-hover:text-slate-700 transition-colors line-clamp-1">
                  {doctor.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mb-1 sm:mb-2 line-clamp-1">{doctor.specialty}</p>
                <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 hidden sm:block">{doctor.description}</p>
                <div className="mt-2 sm:mt-4 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-slate-900 group-hover:text-slate-700">
                  <span>Book Now</span>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-10 sm:mt-16 bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-5 sm:p-8 border border-slate-200 shadow-sm text-center">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3 sm:mb-4">Need Help Choosing?</h3>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            Not sure which specialist is right for you? Book a general consultation and our team 
            will guide you to the best treatment option for your needs.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-6 sm:py-8 mt-12 sm:mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-xs sm:text-sm">
            © {new Date().getFullYear()} Aesthetics Clinic. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
