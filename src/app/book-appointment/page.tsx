"use client";

import Image from "next/image";
import Link from "next/link";

export default function BookAppointmentPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-100 rounded-full opacity-50 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sky-100 rounded-full opacity-50 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg mb-6">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Aesthetics Clinic
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Geneva&apos;s Premier Aesthetic Medicine Center
            </p>
          </div>

          {/* Featured Doctor Card */}
          <div className="max-w-md mx-auto mb-12">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
              <div className="relative h-64 bg-gradient-to-br from-slate-100 to-slate-50">
                <Image
                  src="/doctors/xavier-tenorio.jpg"
                  alt="Dr. Xavier Tenorio"
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>
              <div className="p-6 text-center">
                <h2 className="text-xl font-semibold text-slate-900">Dr. Xavier Tenorio</h2>
                <p className="text-sm text-emerald-600 font-medium">Chirurgien plasticien et esthétique</p>
              </div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
              Welcome to Aesthetics Clinic
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              We believe your vision matters. Our mission is to truly listen, understand your unique needs, 
              and make your aesthetic dream become a reality. Start your journey with a free consultation 
              and 3D simulation at any of our clinics in Switzerland. We also offer online consultations 
              where possible, making it easy to connect with us.
            </p>

            {/* CTA Button */}
            <Link
              href="/book-appointment/doctors"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition-all transform hover:scale-105"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book Appointment
            </Link>
          </div>

          {/* Features */}
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Free Consultation</h3>
              <p className="text-sm text-slate-600">Start with a complimentary consultation to discuss your goals</p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">3D Simulation</h3>
              <p className="text-sm text-slate-600">Visualize your results with advanced 3D technology</p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Swiss Clinics</h3>
              <p className="text-sm text-slate-600">Multiple convenient locations across Switzerland</p>
            </div>
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
