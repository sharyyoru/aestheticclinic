"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

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
  { id: "face", label: "Face", category: "face", icon: "😊" },
  { id: "neck", label: "Neck", category: "face", icon: "🦒" },
  { id: "chest", label: "Chest", category: "body", icon: "💪" },
  { id: "abdomen", label: "Abdomen", category: "body", icon: "🎯" },
  { id: "arms", label: "Arms", category: "body", icon: "💪" },
  { id: "back", label: "Back", category: "body", icon: "🔙" },
  { id: "buttocks", label: "Buttocks", category: "body", icon: "🍑" },
  { id: "thighs", label: "Thighs", category: "body", icon: "🦵" },
  { id: "legs", label: "Legs", category: "body", icon: "🦵" },
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
        await supabaseClient.from("patient_intake_preferences").upsert({
          submission_id: submissionId,
          patient_id: patientId,
          preferred_language: preferredLanguage,
          consultation_type: consultationType,
          preferred_contact_method: contactMethod,
          preferred_contact_time: contactTime,
          additional_notes: additionalNotes || null,
        }, { onConflict: "submission_id" });
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

        await supabaseClient.from("patient_measurements").upsert({
          submission_id: submissionId,
          patient_id: patientId,
          height_cm: height ? parseFloat(height) : null,
          weight_kg: weight ? parseFloat(weight) : null,
          bmi: bmi ? parseFloat(bmi) : null,
          chest_cm: chest ? parseFloat(chest) : null,
          waist_cm: waist ? parseFloat(waist) : null,
          hips_cm: hips ? parseFloat(hips) : null,
        }, { onConflict: "submission_id" });
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
        await supabaseClient.from("patient_treatment_preferences").upsert({
          submission_id: submissionId,
          patient_id: patientId,
          preferred_date_range_start: preferredDateStart || null,
          preferred_date_range_end: preferredDateEnd || null,
          flexibility,
          budget_range: budgetRange,
          financing_interest: financingInterest,
          special_requests: specialRequests || null,
        }, { onConflict: "submission_id" });
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
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 flex flex-col">
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <div className="h-10 w-10 rounded border border-slate-200 flex items-center justify-center bg-white">
            <span className="text-xl font-serif">A</span>
          </div>
          <button className="text-slate-400 hover:text-slate-600 p-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg text-center">
            <h1 className="text-3xl font-light text-slate-900 mb-10">How it Works</h1>
            
            <div className="space-y-6 text-left mb-10">
              {STEP_INFO.slice(0, 8).map((s) => (
                <div key={s.num} className="flex gap-4">
                  <span className="text-2xl font-light text-rose-400 w-8">{s.num}</span>
                  <p className="text-slate-600 text-sm pt-1">{s.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowIntro(false)}
              className="px-12 py-3 rounded-full bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
            >
              CONTINUE
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="h-10 w-10 rounded border border-slate-200 flex items-center justify-center bg-white">
          <span className="text-xl font-serif">A</span>
        </div>
        <div className="text-sm text-slate-500">Step {step} of 8</div>
        <button className="text-slate-400 hover:text-slate-600 p-2">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-rose-400 transition-all duration-300"
          style={{ width: `${(step / 8) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-lg mx-auto">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Step 1: Preferences */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light text-slate-900">Your Preferences</h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Language</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                  <option value="ru">Russian</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Consultation Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {["in-person", "virtual", "either"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setConsultationType(type)}
                      className={`py-2 px-3 rounded-lg text-sm capitalize transition-colors ${
                        consultationType === type
                          ? "bg-rose-100 text-rose-700 border-rose-300 border"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-rose-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Contact Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {["email", "phone", "whatsapp"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setContactMethod(method)}
                      className={`py-2 px-3 rounded-lg text-sm capitalize transition-colors ${
                        contactMethod === method
                          ? "bg-rose-100 text-rose-700 border-rose-300 border"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-rose-200"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Best Time to Contact</label>
                <div className="grid grid-cols-2 gap-3">
                  {["morning", "afternoon", "evening", "anytime"].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setContactTime(time)}
                      className={`py-2 px-3 rounded-lg text-sm capitalize transition-colors ${
                        contactTime === time
                          ? "bg-rose-100 text-rose-700 border-rose-300 border"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-rose-200"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Additional Notes (Optional)</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any specific concerns or preferences..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Treatment Areas */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light text-slate-900">Treatment Areas</h2>
              <p className="text-sm text-slate-500">Select the areas you'd like to treat</p>

              <div className="grid grid-cols-3 gap-3">
                {TREATMENT_AREAS.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleArea(area.id)}
                    className={`p-4 rounded-xl text-center transition-all ${
                      selectedAreas.includes(area.id)
                        ? "bg-rose-100 border-2 border-rose-400"
                        : "bg-white border border-slate-200 hover:border-rose-200"
                    }`}
                  >
                    <span className="text-2xl">{area.icon}</span>
                    <p className="text-xs mt-1 text-slate-600">{area.label}</p>
                  </button>
                ))}
              </div>

              {selectedAreas.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-medium text-slate-700">Specific Concerns</h3>
                  {selectedAreas.map((areaId) => {
                    const area = TREATMENT_AREAS.find((a) => a.id === areaId);
                    return (
                      <div key={areaId} className="space-y-2">
                        <p className="text-sm text-slate-600">{area?.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {CONCERNS.map((concern) => (
                            <button
                              key={concern}
                              type="button"
                              onClick={() => toggleConcern(areaId, concern)}
                              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                                (areaConcerns[areaId] || []).includes(concern)
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
            <div className="space-y-6">
              <h2 className="text-2xl font-light text-slate-900">Measurements</h2>
              <p className="text-sm text-slate-500">Enter your body measurements (optional but helpful)</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="170"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="70"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Chest (cm)</label>
                  <input
                    type="number"
                    value={chest}
                    onChange={(e) => setChest(e.target.value)}
                    placeholder="90"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Waist (cm)</label>
                  <input
                    type="number"
                    value={waist}
                    onChange={(e) => setWaist(e.target.value)}
                    placeholder="75"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-600 mb-1">Hips (cm)</label>
                  <input
                    type="number"
                    value={hips}
                    onChange={(e) => setHips(e.target.value)}
                    placeholder="95"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {height && weight && (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-sm text-slate-600">
                    Calculated BMI:{" "}
                    <span className="font-medium">
                      {(parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Photos */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light text-slate-900">Upload Photos</h2>
              <p className="text-sm text-slate-500">
                Upload clear photos of the areas you wish to treat. This helps our experts better assess your needs.
              </p>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-rose-300 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="text-4xl mb-3">📷</div>
                  <p className="text-sm text-slate-600">Click to upload photos</p>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG, HEIC up to 10MB each</p>
                </label>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Upload ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadedPhotos.length > 0 && (
                <p className="text-sm text-emerald-600">
                  ✓ {uploadedPhotos.length} photo(s) already uploaded
                </p>
              )}
            </div>
          )}

          {/* Step 5: Simulation */}
          {step === 5 && (
            <div className="space-y-6 text-center py-8">
              <div className="text-6xl">🔮</div>
              <h2 className="text-2xl font-light text-slate-900">Personalized Simulation</h2>
              <p className="text-sm text-slate-500">
                Based on the information you've provided, our team will create a personalized simulation
                of your potential results. You'll receive a link to view your simulation after our experts
                have reviewed your information.
              </p>
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-100">
                <p className="text-sm text-rose-700">
                  Simulation will be available within 24-48 hours after submission
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Treatment Preferences */}
          {step === 6 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light text-slate-900">Treatment Preferences</h2>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Date Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={preferredDateStart}
                    onChange={(e) => setPreferredDateStart(e.target.value)}
                    className="px-4 py-3 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    type="date"
                    value={preferredDateEnd}
                    onChange={(e) => setPreferredDateEnd(e.target.value)}
                    className="px-4 py-3 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Schedule Flexibility</label>
                <div className="grid grid-cols-3 gap-3">
                  {["flexible", "specific_dates", "asap"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFlexibility(opt)}
                      className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                        flexibility === opt
                          ? "bg-rose-100 text-rose-700 border-rose-300 border"
                          : "bg-white border border-slate-200 text-slate-600"
                      }`}
                    >
                      {opt === "specific_dates" ? "Specific" : opt === "asap" ? "ASAP" : "Flexible"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Budget Range</label>
                <div className="grid grid-cols-2 gap-3">
                  {["economy", "standard", "premium", "no_limit"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setBudgetRange(opt)}
                      className={`py-2 px-3 rounded-lg text-sm capitalize transition-colors ${
                        budgetRange === opt
                          ? "bg-rose-100 text-rose-700 border-rose-300 border"
                          : "bg-white border border-slate-200 text-slate-600"
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
                  className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-300"
                />
                <label htmlFor="financing" className="text-sm text-slate-600">
                  I'm interested in financing options
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Special Requests</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requirements or requests..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 7: Review */}
          {step === 7 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light text-slate-900">Review Your Information</h2>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-white border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Treatment Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAreas.map((areaId) => {
                      const area = TREATMENT_AREAS.find((a) => a.id === areaId);
                      return (
                        <span key={areaId} className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-sm">
                          {area?.icon} {area?.label}
                        </span>
                      );
                    })}
                    {selectedAreas.length === 0 && (
                      <span className="text-sm text-slate-400">No areas selected</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Measurements</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm text-slate-600">
                    {height && <p>Height: {height}cm</p>}
                    {weight && <p>Weight: {weight}kg</p>}
                    {chest && <p>Chest: {chest}cm</p>}
                    {waist && <p>Waist: {waist}cm</p>}
                    {hips && <p>Hips: {hips}cm</p>}
                    {!height && !weight && <p className="text-slate-400">Not provided</p>}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Photos Uploaded</h3>
                  <p className="text-sm text-slate-600">
                    {uploadedPhotos.length + photos.length} photo(s)
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Preferences</h3>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>Schedule: {flexibility}</p>
                    <p>Budget: {budgetRange.replace("_", " ")}</p>
                    {financingInterest && <p>Interested in financing</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 8: Complete */}
          {step === 8 && (
            <div className="space-y-6 text-center py-8">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-light text-slate-900">You're All Set!</h2>
              <p className="text-sm text-slate-500">
                Thank you for completing the intake form. Your information has been submitted and will be 
                reviewed by our expert team. We'll reach out to discuss the next steps in your journey.
              </p>
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-sm text-emerald-700">
                  ✓ Your submission has been received
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with navigation */}
      {step < 8 && (
        <footer className="border-t border-slate-100 px-6 py-4">
          <div className="max-w-lg mx-auto flex justify-between">
            <button
              onClick={() => step > 1 && setStep((prev) => (prev - 1) as Step)}
              disabled={step === 1 || loading}
              className="px-6 py-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            
            {step === 7 ? (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="px-8 py-2 rounded-full bg-rose-500 text-white font-medium hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={loading}
                className="px-8 py-2 rounded-full bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
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
