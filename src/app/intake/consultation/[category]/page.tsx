"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";

const LIPOSUCTION_AREAS = [
  "Tummy", "Flancs", "Back", "Arms", "Thighs", "Legs", "Breast", "Chin", "Other"
];

const BREAST_OPTIONS = [
  "Augmentation", "Reduction", "Lift", "Reconstruction", "Other"
];

const FACE_OPTIONS = [
  "Facelift", "Rhinoplasty", "Blepharoplasty", "Botox", "Fillers", "Other"
];

function ConsultationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const category = params.category as string;
  const patientId = searchParams.get("pid");
  const submissionId = searchParams.get("sid");

  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const toggleArea = (area: string) => {
    setSelectedAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const getTitle = () => {
    switch (category) {
      case "liposuction":
        return "Customize Your Liposuction Plan";
      case "breast":
        return "Customize Your Breast Consultation";
      case "face":
        return "Customize Your Face Consultation";
      default:
        return "Consultation";
    }
  };

  const getOptions = () => {
    switch (category) {
      case "liposuction":
        return LIPOSUCTION_AREAS;
      case "breast":
        return BREAST_OPTIONS;
      case "face":
        return FACE_OPTIONS;
      default:
        return [];
    }
  };

  const getQuestion = () => {
    switch (category) {
      case "liposuction":
        return "A.) Choose areas of the body to be treated:";
      case "breast":
        return "A.) What type of breast procedure are you interested in?";
      case "face":
        return "A.) What type of facial procedure are you interested in?";
      default:
        return "Select options:";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <Image
          src="/logos/aesthetics-logo.svg"
          alt="Aesthetics Clinic"
          width={60}
          height={60}
          className="h-12 w-auto"
        />
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-light text-slate-800 mb-6">{getTitle()}</h1>
          
          <p className="text-slate-600 text-sm mb-4">{getQuestion()}</p>

          <div className="space-y-3 mb-8">
            {getOptions().map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleArea(option)}
                className={`w-full py-3 px-4 rounded-full border text-center transition-colors ${
                  selectedAreas.includes(option)
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Patient ID: {patientId}<br />
            Submission ID: {submissionId}
          </p>
        </div>
      </div>

      <footer className="sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 sm:px-6 py-4">
        <div className="max-w-md mx-auto flex justify-center items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-3 rounded-full hover:bg-slate-200 transition-colors"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            disabled={selectedAreas.length === 0}
            className="px-8 py-3 rounded-full bg-slate-200 text-slate-600 font-medium hover:bg-slate-300 transition-colors disabled:opacity-50"
          >
            NEXT
          </button>
        </div>
      </footer>
    </main>
  );
}

export default function ConsultationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    }>
      <ConsultationContent />
    </Suspense>
  );
}
