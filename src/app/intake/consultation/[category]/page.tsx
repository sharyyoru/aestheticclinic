"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";

const LIPOSUCTION_AREAS = [
  "Tummy", "Flancs", "Back", "Arms", "Thighs", "Legs", "Breast", "Chin", "Other"
];

const BREAST_OPTIONS = [
  "Augmentation", "Reduction", "Lift", "Reconstruction", "Other"
];

const FACE_OPTIONS = [
  "Facelift", "Rhinoplasty", "Blepharoplasty", "Botox", "Fillers", "Other"
];

// Measurement fields based on selected areas
const AREA_MEASUREMENTS: Record<string, string[]> = {
  "Tummy": ["Upper Tummy", "Lower Tummy"],
  "Flancs": ["Left Lumbar Area", "Right Lumbar Area"],
  "Back": ["Upper Back", "Lower Back"],
  "Arms": ["Left Arm", "Right Arm"],
  "Thighs": ["Left Thigh", "Right Thigh"],
  "Legs": ["Left Leg", "Right Leg"],
  "Breast": ["Left Breast", "Right Breast"],
  "Chin": ["Chin Area"],
  "Other": ["Other Area"]
};

const VIDEO_URL = "https://geneva.aliice.space/storage/guide-videos/8zcexcQrrUk7VXgDAaWGMpVPAgpd9v11BdO0mgir.mp4";

type ConsultationStep = 1 | 2 | 3;

function ConsultationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const category = params.category as string;
  const patientId = searchParams.get("pid");
  const submissionId = searchParams.get("sid");

  const [step, setStep] = useState<ConsultationStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Area selection
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Step 2: Measurements
  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  // Step 3: Photo upload
  const [uploadMode, setUploadMode] = useState<"now" | "later">("now");
  const [photos, setPhotos] = useState<{
    left: File | null;
    front: File | null;
    right: File | null;
    back: File | null;
  }>({ left: null, front: null, right: null, back: null });
  const [uploading, setUploading] = useState(false);

  const fileInputRefs = {
    left: useRef<HTMLInputElement>(null),
    front: useRef<HTMLInputElement>(null),
    right: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
  };

  const toggleArea = (area: string) => {
    setSelectedAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const getMeasurementFields = () => {
    const fields: string[] = [];
    selectedAreas.forEach(area => {
      if (AREA_MEASUREMENTS[area]) {
        fields.push(...AREA_MEASUREMENTS[area]);
      }
    });
    return fields;
  };

  const handleMeasurementChange = (field: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (position: keyof typeof photos, file: File | null) => {
    setPhotos(prev => ({ ...prev, [position]: file }));
  };

  const saveAndProceed = async () => {
    setLoading(true);
    setError(null);

    try {
      // Save consultation data
      const { error: saveError } = await supabaseClient
        .from("patient_consultation_data")
        .upsert({
          patient_id: patientId,
          submission_id: submissionId,
          consultation_type: category,
          selected_areas: selectedAreas,
          measurements: measurements,
          upload_mode: uploadMode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "patient_id,consultation_type" });

      if (saveError) throw saveError;

      // Upload photos if mode is "now"
      if (uploadMode === "now") {
        setUploading(true);
        for (const [position, file] of Object.entries(photos)) {
          if (file) {
            const fileName = `${patientId}/${category}/${position}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabaseClient.storage
              .from("patient-photos")
              .upload(fileName, file);
            
            if (uploadError) {
              console.error(`Failed to upload ${position}:`, uploadError);
            }
          }
        }
        setUploading(false);
      }

      // Redirect to book appointment with patient info
      router.push(`/book-appointment/doctors?pid=${patientId}&sid=${submissionId}&autofill=true`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedAreas.length > 0) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      saveAndProceed();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as ConsultationStep);
    } else {
      window.history.back();
    }
  };

  // Liposuction specific rendering
  if (category === "liposuction") {
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

        <div className="flex-1 overflow-auto px-4 sm:px-6 py-6">
          <div className="max-w-md mx-auto">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Step 1: Select Areas */}
            {step === 1 && (
              <>
                <h1 className="text-2xl font-light text-slate-800 mb-2">Customize Your Liposuction Plan</h1>
                <p className="text-slate-600 text-sm mb-6">A.) Choose areas of the body to be treated:</p>

                <div className="space-y-3 mb-8">
                  {LIPOSUCTION_AREAS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleArea(area)}
                      className={`w-full py-3 px-4 rounded-full border text-center transition-colors ${
                        selectedAreas.includes(area)
                          ? "bg-sky-100 text-sky-700 border-sky-400"
                          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Measurements */}
            {step === 2 && (
              <>
                <h1 className="text-2xl font-light text-slate-800 mb-6">Body Measurements for Evaluation</h1>

                {/* Instruction Box with Video */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                  <h3 className="font-medium text-slate-800 mb-2">Instruction</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Please measure the circumference of the selected limb areas using a flexible measuring tape. 
                    <strong> Wrap the tape snugly (but not tightly)</strong> around the thickest part of the arm, leg, or thigh.
                  </p>
                  
                  {/* Embedded Video */}
                  <video
                    src={VIDEO_URL}
                    controls
                    className="w-full rounded-lg"
                    poster="/video-poster.jpg"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {/* Dynamic Measurement Fields */}
                <div className="space-y-4">
                  {getMeasurementFields().map((field) => (
                    <div key={field}>
                      <label className="block text-sm text-slate-600 mb-1">
                        Please enter measurement of in cm *<br />
                        <span className="font-medium text-slate-800">{field}</span>
                      </label>
                      <input
                        type="number"
                        value={measurements[field] || ""}
                        onChange={(e) => handleMeasurementChange(field, e.target.value)}
                        placeholder="INPUTTEXT"
                        className="w-full px-4 py-3 rounded-full border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 3: Photo Upload */}
            {step === 3 && (
              <>
                <h1 className="text-2xl font-light text-slate-800 mb-6 italic">Upload Your Photos</h1>

                {/* Upload Mode Toggle */}
                <div className="flex justify-center gap-2 mb-6">
                  <button
                    onClick={() => setUploadMode("now")}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                      uploadMode === "now"
                        ? "bg-slate-800 text-white"
                        : "bg-white border border-slate-300 text-slate-600"
                    }`}
                  >
                    Upload Now
                  </button>
                  <button
                    onClick={() => setUploadMode("later")}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                      uploadMode === "later"
                        ? "bg-slate-800 text-white"
                        : "bg-white border border-slate-300 text-slate-600"
                    }`}
                  >
                    Upload Later
                  </button>
                </div>

                {uploadMode === "now" ? (
                  <div className="space-y-4">
                    {(["left", "front", "right", "back"] as const).map((position) => (
                      <div key={position}>
                        <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                          {position} Image
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => fileInputRefs[position].current?.click()}
                            className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-200"
                          >
                            Choose file
                          </button>
                          <span className="text-sm text-slate-500">
                            {photos[position]?.name || "No file chosen"}
                          </span>
                          <input
                            ref={fileInputRefs[position]}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(position, e.target.files?.[0] || null)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sky-600 text-sm">
                      We will send you a link to your email to upload the photos.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 sm:px-6 py-4">
          <div className="max-w-md mx-auto flex justify-center items-center gap-4">
            <button
              onClick={handleBack}
              className="p-3 rounded-full hover:bg-slate-200 transition-colors"
            >
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={loading || uploading || (step === 1 && selectedAreas.length === 0)}
              className="px-8 py-3 rounded-full bg-slate-200 text-slate-600 font-medium hover:bg-slate-300 transition-colors disabled:opacity-50"
            >
              {loading || uploading ? "Processing..." : "NEXT"}
            </button>
          </div>
        </footer>
      </main>
    );
  }

  // Generic consultation page for other categories (breast, face)
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
          <h1 className="text-2xl font-light text-slate-800 mb-6">
            {category === "breast" ? "Customize Your Breast Consultation" : "Customize Your Face Consultation"}
          </h1>
          
          <p className="text-slate-600 text-sm mb-4">
            {category === "breast" 
              ? "A.) What type of breast procedure are you interested in?"
              : "A.) What type of facial procedure are you interested in?"}
          </p>

          <div className="space-y-3 mb-8">
            {(category === "breast" ? BREAST_OPTIONS : FACE_OPTIONS).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleArea(option)}
                className={`w-full py-3 px-4 rounded-full border text-center transition-colors ${
                  selectedAreas.includes(option)
                    ? "bg-sky-100 text-sky-700 border-sky-400"
                    : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
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
            onClick={() => router.push(`/book-appointment/doctors?pid=${patientId}&sid=${submissionId}&autofill=true`)}
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
