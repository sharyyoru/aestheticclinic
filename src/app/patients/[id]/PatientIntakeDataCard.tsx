"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type IntakeSubmission = {
  id: string;
  status: string;
  current_step: number;
  started_at: string;
  completed_at: string | null;
};

type IntakePreferences = {
  preferred_language: string;
  consultation_type: string;
  preferred_contact_method: string;
  preferred_contact_time: string;
  additional_notes: string | null;
};

type TreatmentArea = {
  id: string;
  area_name: string;
  area_category: string;
  specific_concerns: string[];
  priority: number;
};

type Measurements = {
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
};

type IntakePhoto = {
  id: string;
  photo_type: string;
  storage_path: string;
  file_name: string;
  uploaded_at: string;
};

type TreatmentPreferences = {
  preferred_date_range_start: string | null;
  preferred_date_range_end: string | null;
  flexibility: string;
  budget_range: string;
  financing_interest: boolean;
  special_requests: string | null;
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  ru: "Russian",
};

const BMI_CATEGORIES = [
  { max: 18.5, label: "Underweight", color: "text-blue-600 bg-blue-50" },
  { max: 25, label: "Normal", color: "text-emerald-600 bg-emerald-50" },
  { max: 30, label: "Overweight", color: "text-amber-600 bg-amber-50" },
  { max: 100, label: "Obese", color: "text-red-600 bg-red-50" },
];

function getBMICategory(bmi: number) {
  return BMI_CATEGORIES.find((cat) => bmi < cat.max) || BMI_CATEGORIES[3];
}

export default function PatientIntakeDataCard({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<IntakeSubmission | null>(null);
  const [preferences, setPreferences] = useState<IntakePreferences | null>(null);
  const [treatmentAreas, setTreatmentAreas] = useState<TreatmentArea[]>([]);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);
  const [treatmentPrefs, setTreatmentPrefs] = useState<TreatmentPreferences | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadIntakeData() {
      setLoading(true);

      // Get latest intake submission
      const { data: submissions } = await supabaseClient
        .from("patient_intake_submissions")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!submissions || submissions.length === 0) {
        setLoading(false);
        return;
      }

      const sub = submissions[0] as IntakeSubmission;
      setSubmission(sub);

      // Load all related data in parallel
      const [prefsRes, areasRes, measRes, photosRes, treatPrefsRes] = await Promise.all([
        supabaseClient
          .from("patient_intake_preferences")
          .select("*")
          .eq("submission_id", sub.id)
          .single(),
        supabaseClient
          .from("patient_treatment_areas")
          .select("*")
          .eq("submission_id", sub.id)
          .order("priority", { ascending: true }),
        supabaseClient
          .from("patient_measurements")
          .select("*")
          .eq("submission_id", sub.id)
          .single(),
        supabaseClient
          .from("patient_intake_photos")
          .select("*")
          .eq("submission_id", sub.id)
          .order("uploaded_at", { ascending: true }),
        supabaseClient
          .from("patient_treatment_preferences")
          .select("*")
          .eq("submission_id", sub.id)
          .single(),
      ]);

      if (prefsRes.data) setPreferences(prefsRes.data as IntakePreferences);
      if (areasRes.data) setTreatmentAreas(areasRes.data as TreatmentArea[]);
      if (measRes.data) setMeasurements(measRes.data as Measurements);
      if (photosRes.data) setPhotos(photosRes.data as IntakePhoto[]);
      if (treatPrefsRes.data) setTreatmentPrefs(treatPrefsRes.data as TreatmentPreferences);

      // Get signed URLs for photos
      if (photosRes.data && photosRes.data.length > 0) {
        const urls: Record<string, string> = {};
        for (const photo of photosRes.data as IntakePhoto[]) {
          const { data: urlData } = await supabaseClient.storage
            .from("patient-intake-photos")
            .createSignedUrl(photo.storage_path, 3600);
          if (urlData?.signedUrl) {
            urls[photo.id] = urlData.signedUrl;
          }
        }
        setPhotoUrls(urls);
      }

      setLoading(false);
    }

    loadIntakeData();
  }, [patientId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="h-32 bg-slate-200 rounded"></div>
        <div className="h-32 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-200 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm text-slate-600">No intake form data available</p>
        <p className="text-xs text-slate-400 mt-1">Patient has not completed the intake form yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Patient Intake Data</h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            submission.status === "completed"
              ? "bg-emerald-100 text-emerald-700"
              : submission.status === "in_progress"
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {submission.status === "completed" ? "Completed" : submission.status === "in_progress" ? "In Progress" : submission.status}
        </span>
      </div>

      {/* Submission Info */}
      <div className="text-xs text-slate-500 flex gap-4">
        <span>Started: {new Date(submission.started_at).toLocaleDateString()}</span>
        {submission.completed_at && (
          <span>Completed: {new Date(submission.completed_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Preferences Card */}
        {preferences && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h4 className="font-medium text-slate-900">Preferences</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Language</span>
                <span className="text-slate-900 font-medium">{LANGUAGE_LABELS[preferences.preferred_language] || preferences.preferred_language}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Consultation</span>
                <span className="text-slate-900 font-medium capitalize">{preferences.consultation_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact via</span>
                <span className="text-slate-900 font-medium capitalize">{preferences.preferred_contact_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Best time</span>
                <span className="text-slate-900 font-medium capitalize">{preferences.preferred_contact_time}</span>
              </div>
              {preferences.additional_notes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 text-xs">Notes:</span>
                  <p className="text-slate-700 mt-1">{preferences.additional_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Measurements Card */}
        {measurements && (measurements.height_cm || measurements.weight_kg) && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="font-medium text-slate-900">Measurements</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {measurements.height_cm && (
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{measurements.height_cm}</p>
                  <p className="text-xs text-slate-500">Height (cm)</p>
                </div>
              )}
              {measurements.weight_kg && (
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{measurements.weight_kg}</p>
                  <p className="text-xs text-slate-500">Weight (kg)</p>
                </div>
              )}
              {measurements.bmi && (
                <div className={`col-span-2 rounded-lg p-3 text-center ${getBMICategory(measurements.bmi).color}`}>
                  <p className="text-2xl font-bold">{measurements.bmi.toFixed(1)}</p>
                  <p className="text-xs">BMI ({getBMICategory(measurements.bmi).label})</p>
                </div>
              )}
              {measurements.chest_cm && (
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-semibold text-slate-900">{measurements.chest_cm}</p>
                  <p className="text-xs text-slate-500">Chest (cm)</p>
                </div>
              )}
              {measurements.waist_cm && (
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-semibold text-slate-900">{measurements.waist_cm}</p>
                  <p className="text-xs text-slate-500">Waist (cm)</p>
                </div>
              )}
              {measurements.hips_cm && (
                <div className="bg-slate-50 rounded-lg p-2 text-center col-span-2">
                  <p className="text-lg font-semibold text-slate-900">{measurements.hips_cm}</p>
                  <p className="text-xs text-slate-500">Hips (cm)</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Treatment Areas Card */}
        {treatmentAreas.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h4 className="font-medium text-slate-900">Treatment Areas</h4>
            </div>
            <div className="space-y-3">
              {treatmentAreas.map((area, idx) => (
                <div key={area.id} className="border-l-2 border-rose-300 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">#{idx + 1}</span>
                    <span className="font-medium text-slate-900 capitalize">{area.area_name}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{area.area_category}</span>
                  </div>
                  {area.specific_concerns && area.specific_concerns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {area.specific_concerns.map((concern) => (
                        <span
                          key={concern}
                          className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full"
                        >
                          {concern}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Treatment Preferences Card */}
        {treatmentPrefs && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="font-medium text-slate-900">Treatment Preferences</h4>
            </div>
            <div className="space-y-2 text-sm">
              {(treatmentPrefs.preferred_date_range_start || treatmentPrefs.preferred_date_range_end) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Preferred dates</span>
                  <span className="text-slate-900 font-medium">
                    {treatmentPrefs.preferred_date_range_start && new Date(treatmentPrefs.preferred_date_range_start).toLocaleDateString()}
                    {treatmentPrefs.preferred_date_range_start && treatmentPrefs.preferred_date_range_end && " - "}
                    {treatmentPrefs.preferred_date_range_end && new Date(treatmentPrefs.preferred_date_range_end).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Flexibility</span>
                <span className="text-slate-900 font-medium capitalize">{treatmentPrefs.flexibility.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Budget</span>
                <span className="text-slate-900 font-medium capitalize">{treatmentPrefs.budget_range.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Financing interest</span>
                <span className={`font-medium ${treatmentPrefs.financing_interest ? "text-emerald-600" : "text-slate-400"}`}>
                  {treatmentPrefs.financing_interest ? "Yes" : "No"}
                </span>
              </div>
              {treatmentPrefs.special_requests && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 text-xs">Special requests:</span>
                  <p className="text-slate-700 mt-1">{treatmentPrefs.special_requests}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Photos Section */}
      {photos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900">Uploaded Photos</h4>
            <span className="text-xs text-slate-400">({photos.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                {photoUrls[photo.id] ? (
                  <img
                    src={photoUrls[photo.id]}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* Hover overlay with photo info */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-xs text-white truncate">{photo.file_name}</p>
                  <p className="text-xs text-white/60">{new Date(photo.uploaded_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
