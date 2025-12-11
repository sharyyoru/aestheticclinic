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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sky-100 rounded-full opacity-50 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href="/book-appointment"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Choose Your Specialist
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Select a doctor or service to book your appointment
          </p>
        </div>

        {/* Doctors Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {DOCTORS.map((doctor) => (
            <Link
              key={doctor.slug}
              href={`/book-appointment/doctors/${doctor.slug}`}
              className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:border-emerald-200 transition-all transform hover:-translate-y-1"
            >
              <div className="relative h-56 bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden">
                <Image
                  src={doctor.image}
                  alt={doctor.name}
                  fill
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-5">
                <h2 className="text-lg font-semibold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">
                  {doctor.name}
                </h2>
                <p className="text-sm text-emerald-600 font-medium mb-2">{doctor.specialty}</p>
                <p className="text-sm text-slate-500 line-clamp-2">{doctor.description}</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
                  <span>Book Now</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-16 bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">Need Help Choosing?</h3>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Not sure which specialist is right for you? Book a general consultation and our team 
            will guide you to the best treatment option for your needs.
          </p>
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
