"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import Image from "next/image";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const STEP_INFO = [
  { num: 1, title: "Preferences", desc: "Fill Out the Form with all your preferences." },
  { num: 2, title: "Treatment Areas", desc: "Choose the areas of your body you'd like to treat." },
  { num: 3, title: "Measurements", desc: "Enter Measurements." },
  { num: 4, title: "Photos", desc: "Upload clear photos of the areas you wish to treat to help our experts assess your needs." },
  { num: 5, title: "Simulation", desc: "If available, view a personalized simulation of your potential results or receive a link to the simulation after review." },
  { num: 6, title: "Treatment Options", desc: "Select your treatment preferences and finalize your choices, including preferred dates and any additional options." },
  { num: 7, title: "Review", desc: "Review all your information before final submission." },
  { num: 8, title: "Complete", desc: "You're All Set! Once submitted, your information will be reviewed by our expert team, and we'll reach out to discuss the next steps in your journey." },
];

const TREATMENT_AREAS = [
  { id: "face", label: "Face", category: "face" },
  { id: "neck", label: "Neck", category: "face" },
  { id: "chest", label: "Chest", category: "body" },
  { id: "abdomen", label: "Abdomen", category: "body" },
  { id: "arms", label: "Arms", category: "body" },
  { id: "back", label: "Back", category: "body" },
  { id: "buttocks", label: "Buttocks", category: "body" },
  { id: "thighs", label: "Thighs", category: "body" },
  { id: "legs", label: "Legs", category: "body" },
];

const CONCERNS = [
  "Wrinkles & Fine Lines",
  "Sagging Skin",
  "Excess Fat",
  "Scars",
  "Cellulite",
  "Stretch Marks",
  "Pigmentation",
  "Volume Loss",
  "Skin Texture",
  "Other",
];

function IntakeStepsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("sid");
  const patientId = searchParams.get("pid");

  const [step, setStep] = useState<Step>(1);
  const [showIntro, setShowIntro] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Preferences
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [consultationType, setConsultationType] = useState("either");
  const [contactMethod, setContactMethod] = useState("email");
  const [contactTime, setContactTime] = useState("anytime");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Step 2: Treatment Areas
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [areaConcerns, setAreaConcerns] = useState<Record<string, string[]>>({});

  // Step 3: Measurements
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");

  // Step 4: Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

  // Step 6: Treatment Preferences
  const [preferredDateStart, setPreferredDateStart] = useState("");
  const [preferredDateEnd, setPreferredDateEnd] = useState("");
  const [flexibility, setFlexibility] = useState("flexible");
  const [budgetRange, setBudgetRange] = useState("standard");
  const [financingInterest, setFinancingInterest] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");

  useEffect(() => {
    if (!submissionId || !patientId) {
      router.push("/intake");
    }
  }, [submissionId, patientId, router]);

  const toggleArea = (areaId: string) => {
    setSelectedAreas((prev) =>
      prev.includes(areaId)
        ? prev.filter((a) => a !== areaId)
        : [...prev, areaId]
    );
  };

  const toggleConcern = (areaId: string, concern: string) => {
    setAreaConcerns((prev) => {
      const current = prev[areaId] || [];
      const updated = current.includes(concern)
        ? current.filter((c) => c !== concern)
        : [...current, concern];
      return { ...prev, [areaId]: updated };
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setPhotos((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const saveStepData = useCallback(async (currentStep: Step) => {
    if (!submissionId || !patientId) return;

    try {
      setLoading(true);
      setError(null);

      if (currentStep === 1) {
        // Check if preferences exist for this submission
        const { data: existingPrefs } = await supabaseClient
          .from("patient_intake_preferences")
          .select("id")
          .eq("submission_id", submissionId)
          .single();

        const prefsData = {
          submission_id: submissionId,
          patient_id: patientId,
          preferred_language: preferredLanguage,
          consultation_type: consultationType,
          preferred_contact_method: contactMethod,
          preferred_contact_time: contactTime,
          additional_notes: additionalNotes || null,
        };

        if (existingPrefs?.id) {
          await supabaseClient.from("patient_intake_preferences").update(prefsData).eq("id", existingPrefs.id);
        } else {
          await supabaseClient.from("patient_intake_preferences").insert(prefsData);
        }
      }

      if (currentStep === 2) {
        // Delete existing areas first
        await supabaseClient
          .from("patient_treatment_areas")
          .delete()
          .eq("submission_id", submissionId);

        // Insert new areas
        if (selectedAreas.length > 0) {
          const areaRows = selectedAreas.map((areaId, idx) => {
            const area = TREATMENT_AREAS.find((a) => a.id === areaId);
            return {
              submission_id: submissionId,
              patient_id: patientId,
              area_name: areaId,
              area_category: area?.category || "body",
              specific_concerns: areaConcerns[areaId] || [],
              priority: idx + 1,
            };
          });
          await supabaseClient.from("patient_treatment_areas").insert(areaRows);
        }
      }

      if (currentStep === 3) {
        const bmi = height && weight
          ? (parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)
          : null;

        // Check if measurements exist for this submission
        const { data: existingMeasurements } = await supabaseClient
          .from("patient_measurements")
          .select("id")
          .eq("submission_id", submissionId)
          .single();

        const measurementsData = {
          submission_id: submissionId,
          patient_id: patientId,
          height_cm: height ? parseFloat(height) : null,
          weight_kg: weight ? parseFloat(weight) : null,
          bmi: bmi ? parseFloat(bmi) : null,
          chest_cm: chest ? parseFloat(chest) : null,
          waist_cm: waist ? parseFloat(waist) : null,
          hips_cm: hips ? parseFloat(hips) : null,
        };

        if (existingMeasurements?.id) {
          await supabaseClient.from("patient_measurements").update(measurementsData).eq("id", existingMeasurements.id);
        } else {
          await supabaseClient.from("patient_measurements").insert(measurementsData);
        }
      }

      if (currentStep === 4 && photos.length > 0) {
        // Upload photos to storage
        for (const photo of photos) {
          const ext = photo.name.split(".").pop();
          const path = `${patientId}/${submissionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

          const { error: uploadError } = await supabaseClient.storage
            .from("patient-intake-photos")
            .upload(path, photo);

          if (!uploadError) {
            await supabaseClient.from("patient_intake_photos").insert({
              submission_id: submissionId,
              patient_id: patientId,
              photo_type: "area_specific",
              storage_path: path,
              file_name: photo.name,
              mime_type: photo.type,
              file_size: photo.size,
            });
            setUploadedPhotos((prev) => [...prev, path]);
          }
        }
        setPhotos([]);
      }

      if (currentStep === 6) {
        // Check if treatment preferences exist for this submission
        const { data: existingTreatmentPrefs } = await supabaseClient
          .from("patient_treatment_preferences")
          .select("id")
          .eq("submission_id", submissionId)
          .single();

        const treatmentPrefsData = {
          submission_id: submissionId,
          patient_id: patientId,
          preferred_date_range_start: preferredDateStart || null,
          preferred_date_range_end: preferredDateEnd || null,
          flexibility,
          budget_range: budgetRange,
          financing_interest: financingInterest,
          special_requests: specialRequests || null,
        };

        if (existingTreatmentPrefs?.id) {
          await supabaseClient.from("patient_treatment_preferences").update(treatmentPrefsData).eq("id", existingTreatmentPrefs.id);
        } else {
          await supabaseClient.from("patient_treatment_preferences").insert(treatmentPrefsData);
        }
      }

      // Update submission progress
      await supabaseClient
        .from("patient_intake_submissions")
        .update({ current_step: currentStep + 1 })
        .eq("id", submissionId);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save data");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [submissionId, patientId, preferredLanguage, consultationType, contactMethod, contactTime, additionalNotes, selectedAreas, areaConcerns, height, weight, chest, waist, hips, photos, preferredDateStart, preferredDateEnd, flexibility, budgetRange, financingInterest, specialRequests]);

  const handleNext = async () => {
    try {
      await saveStepData(step);
      if (step < 8) {
        setStep((prev) => (prev + 1) as Step);
      }
    } catch {
      // Error already handled in saveStepData
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      
      // Mark submission as completed
      await supabaseClient
        .from("patient_intake_submissions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      // Update patient record
      await supabaseClient
        .from("patients")
        .update({
          intake_submission_id: submissionId,
          intake_completed_at: new Date().toISOString(),
        })
        .eq("id", patientId);

      setStep(8);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete");
    } finally {
      setLoading(false);
    }
  };

  if (showIntro) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
        <header className="px-4 sm:px-6 py-4 flex items-center justify-end">
          <button className="text-slate-400 hover:text-slate-600 p-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-6 sm:py-12">
          <div className="w-full max-w-lg">
            {/* Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <Image
                src="/logos/aesthetics-logo.svg"
                alt="Aesthetics Clinic"
                width={280}
                height={80}
                className="h-14 sm:h-16 w-auto"
                priority
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-light text-black text-center mb-8 sm:mb-10">How it Works</h1>
            
            <div className="space-y-5 sm:space-y-6 text-left mb-8 sm:mb-10">
              {STEP_INFO.slice(0, 8).map((s) => (
                <div key={s.num} className="flex gap-3 sm:gap-4">
                  <span className="text-xl sm:text-2xl font-bold text-black w-6 sm:w-8 flex-shrink-0">{s.num}</span>
                  <p className="text-slate-600 text-sm pt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowIntro(false)}
                className="px-10 sm:px-12 py-3 rounded-full bg-black text-white font-medium hover:bg-slate-800 transition-colors"
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      <header className="px-4 sm:px-6 py-3 flex items-center justify-between">
        <Image
          src="/logos/aesthetics-logo.svg"
          alt="Aesthetics Clinic"
          width={140}
          height={40}
          className="h-8 sm:h-10 w-auto"
        />
        <div className="text-sm text-black font-medium">Step {step} of 8</div>
        <button className="text-slate-400 hover:text-slate-600 p-2">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-black transition-all duration-300"
          style={{ width: `${(step / 8) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-lg mx-auto">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Step 1: Preferences */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl sm:text-2xl font-light text-black">Your Preferences</h2>
              
              <div>
                <label className="block text-sm font-medium text-black mb-2">Preferred Language</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black focus:border-black focus:outline-none"
                >
                  <option value="en" className="text-black">English</option>
                  <option value="fr" className="text-black">French</option>
                  <option value="de" className="text-black">German</option>
                  <option value="es" className="text-black">Spanish</option>
                  <option value="ru" className="text-black">Russian</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Consultation Type</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {["in-person", "virtual", "either"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setConsultationType(type)}
                      className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm capitalize transition-colors ${
                        consultationType === type
                          ? "bg-black text-white border-black border"
                          : "bg-white border border-slate-300 text-black hover:border-black"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Preferred Contact Method</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {["email", "phone", "whatsapp"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setContactMethod(method)}
                      className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm capitalize transition-colors ${
                        contactMethod === method
                          ? "bg-black text-white border-black border"
                          : "bg-white border border-slate-300 text-black hover:border-black"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Best Time to Contact</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {["morning", "afternoon", "evening", "anytime"].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setContactTime(time)}
                      className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm capitalize transition-colors ${
                        contactTime === time
                          ? "bg-black text-white border-black border"
                          : "bg-white border border-slate-300 text-black hover:border-black"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Additional Notes (Optional)</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any specific concerns or preferences..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 resize-none focus:border-black focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Treatment Areas */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl sm:text-2xl font-light text-black">Treatment Areas</h2>
              <p className="text-sm text-slate-600">Select the areas you'd like to treat</p>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {TREATMENT_AREAS.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleArea(area.id)}
                    className={`p-4 rounded-xl text-center transition-all ${
                      selectedAreas.includes(area.id)
                        ? "bg-black text-white border-2 border-black"
                        : "bg-white border border-slate-300 text-black hover:border-black"
                    }`}
                  >
                    <span className="text-base sm:text-lg font-bold">{area.label}</span>
                  </button>
                ))}
              </div>

              {selectedAreas.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-medium text-black">Specific Concerns</h3>
                  {selectedAreas.map((areaId) => {
                    const area = TREATMENT_AREAS.find((a) => a.id === areaId);
                    return (
                      <div key={areaId} className="space-y-2">
                        <p className="text-sm font-medium text-black">{area?.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {CONCERNS.map((concern) => (
                            <button
                              key={concern}
                              type="button"
                              onClick={() => toggleConcern(areaId, concern)}
                              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                                (areaConcerns[areaId] || []).includes(concern)
                                  ? "bg-black text-white"
                                  : "bg-slate-100 text-black hover:bg-slate-200"
                              }`}
                            >
                              {concern}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Measurements */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl sm:text-2xl font-light text-black">Measurements</h2>
              <p className="text-sm text-slate-600">Enter your body measurements (optional but helpful)</p>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm text-black mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="170"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-black mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="70"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-black mb-1">Chest (cm)</label>
                  <input
                    type="number"
                    value={chest}
                    onChange={(e) => setChest(e.target.value)}
                    placeholder="90"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-black mb-1">Waist (cm)</label>
                  <input
                    type="number"
                    value={waist}
                    onChange={(e) => setWaist(e.target.value)}
                    placeholder="75"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-black mb-1">Hips (cm)</label>
                  <input
                    type="number"
                    value={hips}
                    onChange={(e) => setHips(e.target.value)}
                    placeholder="95"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none"
                  />
                </div>
              </div>

              {height && weight && (
                <div className="p-4 rounded-lg bg-black text-white">
                  <p className="text-sm">
                    Calculated BMI:{" "}
                    <span className="font-bold text-lg">
                      {(parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)}
                    </span>
                    <span className="ml-2 text-slate-300">
                      {(() => {
                        const bmi = parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2);
                        if (bmi < 18.5) return "(Underweight)";
                        if (bmi < 25) return "(Normal)";
                        if (bmi < 30) return "(Overweight)";
                        return "(Obese)";
                      })()}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Photos */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-xl sm:text-2xl font-light text-black">Upload Photos</h2>
              <p className="text-sm text-slate-600">
                Upload clear photos of the areas you wish to treat. This helps our experts better assess your needs.
              </p>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 sm:p-8 text-center hover:border-black transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-black flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-black font-medium">Click to upload photos</p>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG, HEIC up to 10MB each</p>
                </label>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Upload ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadedPhotos.length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-sm text-emerald-700">
                    ✓ {uploadedPhotos.length} photo(s) already uploaded
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Simulation */}
          {step === 5 && (
            <div className="space-y-5 text-center py-6 sm:py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-black flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-light text-black">Personalized Simulation</h2>
              <p className="text-sm text-slate-600">
                Based on the information you've provided, our team will create a personalized simulation
                of your potential results. You'll receive a link to view your simulation after our experts
                have reviewed your information.
              </p>
              <div className="p-4 rounded-lg bg-slate-100 border border-slate-200">
                <p className="text-sm text-black">
                  Simulation will be available within 24-48 hours after submission
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Treatment Preferences */}
          {step === 6 && (
            <div className="space-y-5">
              <h2 className="text-xl sm:text-2xl font-light text-black">Treatment Preferences</h2>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Preferred Date Range</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <input
                    type="date"
                    value={preferredDateStart}
                    onChange={(e) => setPreferredDateStart(e.target.value)}
                    className="px-4 py-3 rounded-lg border border-slate-300 bg-white text-black focus:border-black focus:outline-none"
                  />
                  <input
                    type="date"
                    value={preferredDateEnd}
                    onChange={(e) => setPreferredDateEnd(e.target.value)}
                    className="px-4 py-3 rounded-lg border border-slate-300 bg-white text-black focus:border-black focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Schedule Flexibility</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {["flexible", "specific_dates", "asap"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFlexibility(opt)}
                      className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm transition-colors ${
                        flexibility === opt
                          ? "bg-black text-white border-black border"
                          : "bg-white border border-slate-300 text-black hover:border-black"
                      }`}
                    >
                      {opt === "specific_dates" ? "Specific" : opt === "asap" ? "ASAP" : "Flexible"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Budget Range</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {["economy", "standard", "premium", "no_limit"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setBudgetRange(opt)}
                      className={`py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm capitalize transition-colors ${
                        budgetRange === opt
                          ? "bg-black text-white border-black border"
                          : "bg-white border border-slate-300 text-black hover:border-black"
                      }`}
                    >
                      {opt.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="financing"
                  checked={financingInterest}
                  onChange={(e) => setFinancingInterest(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-black focus:ring-black accent-black"
                />
                <label htmlFor="financing" className="text-sm text-black">
                  I'm interested in financing options
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Special Requests</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requirements or requests..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 resize-none focus:border-black focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 7: Review */}
          {step === 7 && (
            <div className="space-y-5">
              <h2 className="text-xl sm:text-2xl font-light text-black">Review Your Information</h2>
              
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-white border border-slate-300">
                  <h3 className="text-sm font-medium text-black mb-2">Treatment Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAreas.map((areaId) => {
                      const area = TREATMENT_AREAS.find((a) => a.id === areaId);
                      return (
                        <span key={areaId} className="px-3 py-1 rounded-full bg-black text-white text-sm">
                          {area?.label}
                        </span>
                      );
                    })}
                    {selectedAreas.length === 0 && (
                      <span className="text-sm text-slate-400">No areas selected</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-300">
                  <h3 className="text-sm font-medium text-black mb-2">Measurements</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-black">
                    {height && <p>Height: {height}cm</p>}
                    {weight && <p>Weight: {weight}kg</p>}
                    {height && weight && (
                      <p>BMI: {(parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)}</p>
                    )}
                    {chest && <p>Chest: {chest}cm</p>}
                    {waist && <p>Waist: {waist}cm</p>}
                    {hips && <p>Hips: {hips}cm</p>}
                    {!height && !weight && <p className="text-slate-400">Not provided</p>}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-300">
                  <h3 className="text-sm font-medium text-black mb-2">Photos Uploaded</h3>
                  <p className="text-sm text-black">
                    {uploadedPhotos.length + photos.length} photo(s)
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-300">
                  <h3 className="text-sm font-medium text-black mb-2">Preferences</h3>
                  <div className="text-sm text-black space-y-1">
                    <p>Schedule: <span className="capitalize">{flexibility.replace("_", " ")}</span></p>
                    <p>Budget: <span className="capitalize">{budgetRange.replace("_", " ")}</span></p>
                    {financingInterest && <p>Interested in financing</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 8: Complete */}
          {step === 8 && (
            <div className="space-y-5 text-center py-6 sm:py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-black flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-light text-black">You're All Set!</h2>
              <p className="text-sm text-slate-600">
                Thank you for completing the intake form. Your information has been submitted and will be 
                reviewed by our expert team. We'll reach out to discuss the next steps in your journey.
              </p>
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm text-emerald-700">
                  ✓ Your submission has been received
                </p>
              </div>
              
              {/* Book Appointment Button */}
              <div className="pt-4">
                <a
                  href={`/book-appointment?name=${encodeURIComponent(patientId || "")}&from=intake`}
                  className="inline-block w-full sm:w-auto px-8 py-3 rounded-full bg-black text-white font-medium hover:bg-slate-800 transition-colors"
                >
                  Book an Appointment
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with navigation - closer to content */}
      {step < 8 && (
        <footer className="sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 sm:px-6 py-3 sm:py-4">
          <div className="max-w-lg mx-auto flex justify-between items-center gap-4">
            <button
              onClick={() => step > 1 && setStep((prev) => (prev - 1) as Step)}
              disabled={step === 1 || loading}
              className="px-4 sm:px-6 py-2.5 rounded-full text-black hover:bg-slate-200 transition-colors disabled:opacity-30 text-sm sm:text-base"
            >
              Back
            </button>
            
            {step === 7 ? (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="px-6 sm:px-8 py-2.5 rounded-full bg-black text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={loading}
                className="px-6 sm:px-8 py-2.5 rounded-full bg-black text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            )}
          </div>
        </footer>
      )}
    </main>
  );
}

export default function IntakeStepsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    }>
      <IntakeStepsContent />
    </Suspense>
  );
}
