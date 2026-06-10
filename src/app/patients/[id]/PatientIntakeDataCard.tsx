"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { ChevronDown, Upload, Camera, Check, X } from "lucide-react";

const COLLAPSE_KEY = "patientIntakeData_collapsed";

type IntakeSubmission = {
  id: string;
  status: string;
  current_step: number;
  started_at: string;
  completed_at: string | null;
};

type IntakePreferences = {
  id?: string;
  submission_id?: string;
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
  id?: string;
  submission_id?: string;
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
  id?: string;
  submission_id?: string;
  preferred_date_range_start: string | null;
  preferred_date_range_end: string | null;
  flexibility: string;
  budget_range: string;
  financing_interest: boolean;
  special_requests: string | null;
};

type HealthBackground = {
  id?: string;
  submission_id?: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  known_illnesses: string | null;
  previous_surgeries: string | null;
  allergies: string | null;
  cigarettes: string | null;
  alcohol_consumption: string | null;
  sports_activity: string | null;
  medications: string | null;
  general_practitioner: string | null;
  gynecologist: string | null;
  children_count: number | null;
  birth_type_1: string | null;
  birth_type_2: string | null;
};

type PatientInsurance = {
  id?: string;
  patient_id?: string;
  provider_name: string | null;
  card_number: string | null;
  insurance_type: string | null;
};

type ConsultationData = {
  id: string;
  consultation_type: string;
  selected_areas: string[] | null;
  measurements: Record<string, string> | null;
  breast_data: Record<string, unknown> | null;
  face_data: Record<string, unknown> | null;
  upload_mode: string;
  created_at: string;
};

type EditingSection = "preferences" | "measurements" | "treatment_prefs" | "health_background" | "insurance" | "treatment_areas" | null;

// Health background dropdown options (from intake form)
const ALCOHOL_OPTIONS = ["Never", "Rarely", "Occasionally", "Frequently", "Daily"];
const SPORTS_OPTIONS = ["Never", "Rarely", "Occasionally", "Frequently", "Daily"];
const BIRTH_TYPES = ["Natural", "C-section"];

// Treatment area options (from consultation forms)
const LIPOSUCTION_AREAS = ["Tummy", "Flancs", "Back", "Arms", "Thighs", "Legs", "Breast", "Chin", "Other"];
const FACE_PRIORITY_AREAS = ["Wrinkles", "Eyebags", "Nasolabial Fold", "Jaw Line", "Neck"];
const BREAST_PROCEDURE_TYPES = ["Breast Augmentation", "Breast Reduction", "Breast Lift", "Breast Reconstruction", "Breast Exchange"];

// Additional form options
const FACE_EFFECTS = [
  "Looking less saggy", "Less angry", "Less tired", "More attractive", 
  "More feminine", "Masculine", "More young"
];
const FACE_BUDGET_OPTIONS = ["$ 500", "$ 1,000", "$ 2,000", "$ 2,000 +"];
const BREAST_SURGERY_TYPES = [
  "Augmentation", "Reduction", "Lift", "Benign Tumor Removal", 
  "Malignant Tumor Removal", "Reconstruction", "Malformation", "Other"
];
const AUGMENTATION_OPTIONS = ["Implant", "Fat Transplantation", "I don't know"];
const CUP_SIZES = ["SIZE A", "SIZE B", "SIZE C", "SIZE D", "SIZE E", "SIZE F", "SIZE G"];
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
const CONSULTATION_TYPES = [
  { id: "liposuction", label: "Liposuction / Body", icon: "🏃", color: "rose" },
  { id: "face", label: "Face", icon: "👤", color: "sky" },
  { id: "breast", label: "Breast", icon: "💜", color: "purple" },
];

// Photo positions for each consultation type
const LIPOSUCTION_PHOTO_POSITIONS = [
  { id: "left", label: "Left Image" },
  { id: "front", label: "Front Image" },
  { id: "right", label: "Right Image" },
  { id: "back", label: "Back Image" },
];

const FACE_PHOTO_POSITIONS = [
  { id: "left_45", label: "Left 45° Image" },
  { id: "front", label: "Front Image" },
  { id: "right_45", label: "Right 45° Image" },
  { id: "right_profile", label: "Right Profile" },
  { id: "left_profile", label: "Left Profile" },
];

const BREAST_PHOTO_POSITIONS = [
  { id: "left", label: "Left Image" },
  { id: "front", label: "Front Image" },
  { id: "right", label: "Right Image" },
  { id: "right_profile", label: "Right Profile" },
  { id: "left_profile", label: "Left Profile" },
];

const BREAST_MEASUREMENTS_FIELDS = [
  { id: "sternum_nipple_right", label: "Sternum to Nipple (Right)", required: true },
  { id: "sternum_nipple_left", label: "Sternum to Nipple (Left)", required: true },
  { id: "submammary_fold_right", label: "Submammary Fold (Right)", required: false },
  { id: "submammary_fold_left", label: "Submammary Fold (Left)", required: false },
  { id: "nipple_mammary_left", label: "Nipple to Mammary Base (Left)", required: false },
  { id: "nipple_mammary_right", label: "Nipple to Mammary Base (Right)", required: false },
  { id: "inter_nipple", label: "Inter-Nipple Distance", required: false },
  { id: "upper_pole_right", label: "Upper Pole Pinch (Right)", required: false },
  { id: "upper_pole_left", label: "Upper Pole Pinch (Left)", required: false },
];

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  ru: "Russian",
};

const TREATMENT_AREAS_OPTIONS = [
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

const BMI_CATEGORIES = [
  { max: 18.5, label: "Underweight", color: "text-blue-600 bg-blue-50" },
  { max: 25, label: "Normal", color: "text-emerald-600 bg-emerald-50" },
  { max: 30, label: "Overweight", color: "text-amber-600 bg-amber-50" },
  { max: 100, label: "Obese", color: "text-red-600 bg-red-50" },
];

function getBMICategory(bmi: number) {
  return BMI_CATEGORIES.find((cat) => bmi < cat.max) || BMI_CATEGORIES[3];
}

function calculateBMI(height: number | null, weight: number | null): number | null {
  if (!height || !weight || height <= 0) return null;
  return parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1));
}

export default function PatientIntakeDataCard({ 
  patientId, 
  collapsible = false 
}: { 
  patientId: string;
  collapsible?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Load collapse preference from localStorage
  useEffect(() => {
    if (collapsible) {
      const stored = localStorage.getItem(`${COLLAPSE_KEY}_${patientId}`);
      if (stored === "true") {
        setCollapsed(true);
      }
    }
  }, [patientId, collapsible]);

  // Save collapse preference
  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(`${COLLAPSE_KEY}_${patientId}`, String(newState));
  };
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState<IntakeSubmission | null>(null);
  const [preferences, setPreferences] = useState<IntakePreferences | null>(null);
  const [treatmentAreas, setTreatmentAreas] = useState<TreatmentArea[]>([]);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);
  const [treatmentPrefs, setTreatmentPrefs] = useState<TreatmentPreferences | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [healthBackground, setHealthBackground] = useState<HealthBackground | null>(null);
  const [insurance, setInsurance] = useState<PatientInsurance | null>(null);
  const [consultationData, setConsultationData] = useState<ConsultationData[]>([]);
  
  // Edit mode states
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [editPrefs, setEditPrefs] = useState<IntakePreferences | null>(null);
  const [editMeasurements, setEditMeasurements] = useState<Measurements | null>(null);
  const [editTreatmentPrefs, setEditTreatmentPrefs] = useState<TreatmentPreferences | null>(null);
  const [editInsurance, setEditInsurance] = useState<PatientInsurance | null>(null);
  const [editHealthBackground, setEditHealthBackground] = useState<HealthBackground | null>(null);
  const [editTreatmentAreas, setEditTreatmentAreas] = useState<{liposuction: string[], face: string[], breast: string[]}>({ liposuction: [], face: [], breast: [] });
  const [activeConsultationType, setActiveConsultationType] = useState<string | null>(null);
  
  // Liposuction form state
  const [lipoMeasurements, setLipoMeasurements] = useState<Record<string, string>>({});
  
  // Face form state
  const [faceHadTreatments, setFaceHadTreatments] = useState<"yes" | "no" | null>(null);
  const [faceTreatmentKind, setFaceTreatmentKind] = useState("");
  const [faceTreatmentWhen, setFaceTreatmentWhen] = useState("");
  const [faceEffects, setFaceEffects] = useState<string[]>([]);
  const [faceBudget, setFaceBudget] = useState("");
  
  // Breast form state
  const [breastHadSurgery, setBreastHadSurgery] = useState<"yes" | "no" | null>(null);
  const [breastSurgeryTypes, setBreastSurgeryTypes] = useState<string[]>([]);
  const [breastHadBreastfeed, setBreastHadBreastfeed] = useState<"yes" | "no" | null>(null);
  const [breastfeedHowLong, setBreastfeedHowLong] = useState("");
  const [breastHadConditions, setBreastHadConditions] = useState<"yes" | "no" | null>(null);
  const [breastConditionsDetails, setBreastConditionsDetails] = useState("");
  const [breastHadUltrasound, setBreastHadUltrasound] = useState<"yes" | "no" | null>(null);
  const [breastUltrasoundHowLong, setBreastUltrasoundHowLong] = useState("");
  const [breastUltrasoundWhy, setBreastUltrasoundWhy] = useState("");
  const [breastHadPreviousConsult, setBreastHadPreviousConsult] = useState<"yes" | "no" | null>(null);
  const [breastAugmentationOption, setBreastAugmentationOption] = useState("");
  const [breastDesiredCupSize, setBreastDesiredCupSize] = useState("");
  const [breastReductionComments, setBreastReductionComments] = useState("");
  const [breastLiftComments, setBreastLiftComments] = useState("");
  const [breastMeasurements, setBreastMeasurements] = useState<Record<string, string>>({});
  
  // Photo upload state
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<Record<string, number>>({});
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<Record<string, string>>({});
  const [consultationPhotos, setConsultationPhotos] = useState<Array<{id: string; path: string; position: string; consultationType: string; url?: string}>>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadIntakeData = useCallback(async () => {
    setLoading(true);

    // Get latest intake submission
    const { data: submissions } = await supabaseClient
      .from("patient_intake_submissions")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!submissions || submissions.length === 0) {
      // Create a new submission if none exists
      const { data: newSub } = await supabaseClient
        .from("patient_intake_submissions")
        .insert({ patient_id: patientId, status: "in_progress", current_step: 1 })
        .select()
        .single();
      
      if (newSub) {
        setSubmission(newSub as IntakeSubmission);
      }
      setLoading(false);
      return;
    }

    const sub = submissions[0] as IntakeSubmission;
    setSubmission(sub);

    // Load all related data by PATIENT_ID first (most reliable), then fall back to submission_id
    // This ensures we always find data regardless of which submission it was linked to
    const [prefsRes, healthRes, insuranceRes, areasRes, measRes, photosRes, treatPrefsRes] = await Promise.all([
      // Preferences: query by patient_id directly
      supabaseClient
        .from("patient_intake_preferences")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Health background: query by patient_id directly
      supabaseClient
        .from("patient_health_background")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Insurance: query by patient_id directly
      supabaseClient
        .from("patient_insurances")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Treatment areas: try by submission_id first
      supabaseClient
        .from("patient_treatment_areas")
        .select("*")
        .eq("submission_id", sub.id)
        .order("priority", { ascending: true }),
      // Measurements: try by submission_id first
      supabaseClient
        .from("patient_measurements")
        .select("*")
        .eq("submission_id", sub.id)
        .maybeSingle(),
      // Photos: try by submission_id first
      supabaseClient
        .from("patient_intake_photos")
        .select("*")
        .eq("submission_id", sub.id)
        .order("uploaded_at", { ascending: true }),
      // Treatment preferences: try by submission_id first
      supabaseClient
        .from("patient_treatment_preferences")
        .select("*")
        .eq("submission_id", sub.id)
        .maybeSingle(),
    ]);

    // Set preferences (queried by patient_id)
    if (prefsRes.data) {
      setPreferences(prefsRes.data as IntakePreferences);
    }
    
    // Set health background (queried by patient_id)
    if (healthRes.data) {
      setHealthBackground(healthRes.data as HealthBackground);
    }

    // Set other data from submission-based queries
    if (areasRes.data) setTreatmentAreas(areasRes.data as TreatmentArea[]);
    if (measRes.data) setMeasurements(measRes.data as Measurements);
    if (photosRes.data) setPhotos(photosRes.data as IntakePhoto[]);
    if (treatPrefsRes.data) setTreatmentPrefs(treatPrefsRes.data as TreatmentPreferences);

    // Fetch consultation data (liposuction, breast, face)
    const { data: consultations } = await supabaseClient
      .from("patient_consultation_data")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    
    if (consultations) {
      setConsultationData(consultations as ConsultationData[]);
    }
    
    // Insurance: try patient_insurances first, then patient_insurance (legacy table) as fallback
    if (insuranceRes.data) {
      setInsurance(insuranceRes.data as PatientInsurance);
    } else {
      // Fallback: try legacy patient_insurance table (singular)
      try {
        const { data: legacyIns } = await supabaseClient
          .from("patient_insurance")
          .select("*")
          .eq("patient_id", patientId)
          .maybeSingle();
        if (legacyIns) setInsurance(legacyIns as PatientInsurance);
      } catch {
        // Legacy table may not exist, ignore error
      }
    }

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

    // Load consultation photos from patient_document bucket
    const consultationPhotosList: Array<{id: string; path: string; position: string; consultationType: string; url?: string}> = [];
    const photoUrlsMap: Record<string, string> = {};
    
    for (const consultType of ["liposuction", "face", "breast"]) {
      const folderPath = `${patientId}/consultation_photos/${consultType}`;
      const { data: photoFiles } = await supabaseClient.storage
        .from("patient_document")
        .list(folderPath, { limit: 50 });
      
      if (photoFiles && photoFiles.length > 0) {
        for (const file of photoFiles) {
          if (file.name === ".keep") continue;
          const fullPath = `${folderPath}/${file.name}`;
          const position = file.name.split("_")[0]; // e.g., "front_1234.jpg" -> "front"
          
          const { data: urlData } = await supabaseClient.storage
            .from("patient_document")
            .createSignedUrl(fullPath, 3600);
          
          if (urlData?.signedUrl) {
            photoUrlsMap[fullPath] = urlData.signedUrl;
            consultationPhotosList.push({
              id: file.id || fullPath,
              path: fullPath,
              position,
              consultationType: consultType,
              url: urlData.signedUrl,
            });
          }
        }
      }
    }
    
    setConsultationPhotos(consultationPhotosList);
    setUploadedPhotoUrls(photoUrlsMap);

    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadIntakeData();
  }, [loadIntakeData]);

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

  // Save handlers
  const savePreferences = async (data: Partial<IntakePreferences>) => {
    if (!submission) return;
    setSaving(true);
    try {
      if (preferences?.id) {
        await supabaseClient.from("patient_intake_preferences").update(data).eq("id", preferences.id);
      } else {
        await supabaseClient.from("patient_intake_preferences").insert({
          ...data,
          submission_id: submission.id,
          patient_id: patientId,
        });
      }
      await loadIntakeData();
      setEditingSection(null);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
    setSaving(false);
  };

  const saveMeasurements = async (data: Partial<Measurements>) => {
    if (!submission) return;
    setSaving(true);
    try {
      const bmi = calculateBMI(data.height_cm ?? null, data.weight_kg ?? null);
      const payload = { ...data, bmi };
      
      if (measurements?.id) {
        await supabaseClient.from("patient_measurements").update(payload).eq("id", measurements.id);
      } else {
        await supabaseClient.from("patient_measurements").insert({
          ...payload,
          submission_id: submission.id,
          patient_id: patientId,
        });
      }
      await loadIntakeData();
      setEditingSection(null);
    } catch (err) {
      console.error("Failed to save measurements:", err);
    }
    setSaving(false);
  };

  const saveTreatmentPrefs = async (data: Partial<TreatmentPreferences>) => {
    if (!submission) return;
    setSaving(true);
    try {
      if (treatmentPrefs?.id) {
        await supabaseClient.from("patient_treatment_preferences").update(data).eq("id", treatmentPrefs.id);
      } else {
        await supabaseClient.from("patient_treatment_preferences").insert({
          ...data,
          submission_id: submission.id,
          patient_id: patientId,
        });
      }
      await loadIntakeData();
      setEditingSection(null);
    } catch (err) {
      console.error("Failed to save treatment preferences:", err);
    }
    setSaving(false);
  };

  const saveInsurance = async (data: Partial<PatientInsurance>) => {
    setSaving(true);
    try {
      const saveData = {
        provider_name: data.provider_name || null,
        card_number: data.card_number || null,
        insurance_type: data.insurance_type || null,
      };

      if (insurance?.id) {
        const { error } = await supabaseClient.from("patient_insurances").update(saveData).eq("id", insurance.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from("patient_insurances").insert({
          ...saveData,
          patient_id: patientId,
        });
        if (error) throw error;
      }
      await loadIntakeData();
      setEditingSection(null);
    } catch (err) {
      console.error("Failed to save insurance:", err);
      alert(`Failed to save insurance: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSaving(false);
  };

  const saveHealthBackground = async (data: Partial<HealthBackground>) => {
    setSaving(true);
    try {
      const bmi = data.weight_kg && data.height_cm 
        ? parseFloat((data.weight_kg / Math.pow(data.height_cm / 100, 2)).toFixed(1))
        : null;

      const saveData = {
        weight_kg: data.weight_kg || null,
        height_cm: data.height_cm || null,
        bmi: bmi,
        known_illnesses: data.known_illnesses || null,
        previous_surgeries: data.previous_surgeries || null,
        allergies: data.allergies || null,
        cigarettes: data.cigarettes || null,
        alcohol_consumption: data.alcohol_consumption || null,
        sports_activity: data.sports_activity || null,
        medications: data.medications || null,
        general_practitioner: data.general_practitioner || null,
        gynecologist: data.gynecologist || null,
        children_count: data.children_count || null,
        birth_type_1: data.birth_type_1 || null,
        birth_type_2: data.birth_type_2 || null,
      };

      if (healthBackground?.id) {
        const { error } = await supabaseClient.from("patient_health_background").update(saveData).eq("id", healthBackground.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from("patient_health_background").insert({
          ...saveData,
          patient_id: patientId,
          submission_id: submission?.id,
        });
        if (error) throw error;
      }
      await loadIntakeData();
      setEditingSection(null);
    } catch (err) {
      console.error("Failed to save health background:", err);
      alert(`Failed to save health background: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSaving(false);
  };

  const saveTreatmentAreas = async (data: {liposuction: string[], face: string[], breast: string[]}) => {
    setSaving(true);
    try {
      // Save liposuction data if any areas selected
      if (data.liposuction.length > 0 || Object.keys(lipoMeasurements).length > 0) {
        const existingLipo = consultationData.find(c => c.consultation_type === "liposuction");
        const lipoData = {
          patient_id: patientId,
          consultation_type: "liposuction",
          selected_areas: data.liposuction,
          measurements: lipoMeasurements,
          upload_mode: "later",
        };
        if (existingLipo) {
          await supabaseClient.from("patient_consultation_data").update(lipoData).eq("id", existingLipo.id);
        } else {
          await supabaseClient.from("patient_consultation_data").insert(lipoData);
        }
      }

      // Save face data if any areas or effects selected
      if (data.face.length > 0 || faceEffects.length > 0 || faceHadTreatments || faceBudget) {
        const existingFace = consultationData.find(c => c.consultation_type === "face");
        const faceDataPayload = {
          patient_id: patientId,
          consultation_type: "face",
          face_data: { 
            priority_areas: data.face, 
            effects: faceEffects,
            had_treatments: faceHadTreatments,
            treatment_kind: faceTreatmentKind,
            treatment_when: faceTreatmentWhen,
            budget: faceBudget,
          },
          upload_mode: "later",
        };
        if (existingFace) {
          await supabaseClient.from("patient_consultation_data").update(faceDataPayload).eq("id", existingFace.id);
        } else {
          await supabaseClient.from("patient_consultation_data").insert(faceDataPayload);
        }
      }

      // Save breast data if any procedures selected
      if (data.breast.length > 0 || breastHadSurgery || breastSurgeryTypes.length > 0) {
        const existingBreast = consultationData.find(c => c.consultation_type === "breast");
        const breastDataPayload = {
          patient_id: patientId,
          consultation_type: "breast",
          breast_data: { 
            procedure_types: data.breast,
            had_surgery: breastHadSurgery,
            surgery_types: breastSurgeryTypes,
            had_breastfeed: breastHadBreastfeed,
            breastfeed_how_long: breastfeedHowLong,
            had_conditions: breastHadConditions,
            conditions_details: breastConditionsDetails,
            had_ultrasound: breastHadUltrasound,
            ultrasound_how_long: breastUltrasoundHowLong,
            ultrasound_why: breastUltrasoundWhy,
            had_previous_consultation: breastHadPreviousConsult,
            augmentation_option: breastAugmentationOption,
            desired_cup_size: breastDesiredCupSize,
            reduction_comments: breastReductionComments,
            lift_comments: breastLiftComments,
          },
          measurements: breastMeasurements,
          upload_mode: "later",
        };
        if (existingBreast) {
          await supabaseClient.from("patient_consultation_data").update(breastDataPayload).eq("id", existingBreast.id);
        } else {
          await supabaseClient.from("patient_consultation_data").insert(breastDataPayload);
        }
      }

      await loadIntakeData();
      setEditingSection(null);
      setActiveConsultationType(null);
    } catch (err) {
      console.error("Failed to save treatment areas:", err);
      alert(`Failed to save treatment areas: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSaving(false);
  };

  // Photo upload function
  const handlePhotoUpload = async (consultationType: string, position: string, file: File) => {
    if (!file) return;
    
    setUploadingPhotos(true);
    const key = `${consultationType}_${position}`;
    setPhotoUploadProgress(prev => ({ ...prev, [key]: 10 }));
    
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${position}_${Date.now()}.${ext}`;
      const storagePath = `${patientId}/consultation_photos/${consultationType}/${fileName}`;
      
      setPhotoUploadProgress(prev => ({ ...prev, [key]: 50 }));
      
      const { error: uploadError } = await supabaseClient.storage
        .from("patient_document")
        .upload(storagePath, file, { 
          cacheControl: '3600',
          upsert: false 
        });
      
      if (uploadError) {
        console.error("Upload error:", uploadError);
        setPhotoUploadProgress(prev => ({ ...prev, [key]: 0 }));
        alert(`Failed to upload photo: ${uploadError.message}`);
        setUploadingPhotos(false);
        return;
      }
      
      setPhotoUploadProgress(prev => ({ ...prev, [key]: 100 }));
      
      // Get signed URL for the uploaded photo
      const { data: urlData } = await supabaseClient.storage
        .from("patient_document")
        .createSignedUrl(storagePath, 3600);
      
      if (urlData?.signedUrl) {
        setUploadedPhotoUrls(prev => ({ ...prev, [storagePath]: urlData.signedUrl }));
        setConsultationPhotos(prev => [...prev, {
          id: storagePath,
          path: storagePath,
          position,
          consultationType,
          url: urlData.signedUrl,
        }]);
      }
      
      // Clear progress after a moment
      setTimeout(() => {
        setPhotoUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[key];
          return newProgress;
        });
      }, 1500);
      
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert(`Failed to upload photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhotoUploadProgress(prev => ({ ...prev, [key]: 0 }));
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Get photos for a specific consultation type
  const getPhotosForConsultation = (consultationType: string) => {
    return consultationPhotos.filter(p => p.consultationType === consultationType);
  };

  // Render photo upload section for a consultation type
  const renderPhotoUploadSection = (consultationType: string, positions: Array<{id: string; label: string}>) => {
    const existingPhotos = getPhotosForConsultation(consultationType);
    
    return (
      <div className="border-t border-slate-200 pt-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-slate-500" />
          <label className="text-xs font-medium text-slate-600">Upload Photos</label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {positions.map((pos) => {
            const key = `${consultationType}_${pos.id}`;
            const existingPhoto = existingPhotos.find(p => p.position === pos.id);
            const progress = photoUploadProgress[key];
            
            return (
              <div key={pos.id} className="relative">
                <label className="text-xs text-slate-500 mb-1 block">{pos.label}</label>
                
                {existingPhoto?.url ? (
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                    <img src={existingPhoto.url} alt={pos.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[key]?.click()}
                        className="p-2 bg-white rounded-full text-slate-700 hover:bg-slate-100"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute top-1 right-1">
                      <Check className="w-4 h-4 text-emerald-500 bg-white rounded-full p-0.5" />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[key]?.click()}
                    disabled={uploadingPhotos}
                    className="w-full aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-xs text-slate-400">Upload</span>
                  </button>
                )}
                
                {progress !== undefined && progress > 0 && progress < 100 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
                
                <input
                  ref={(el) => { fileInputRefs.current[key] = el; }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(consultationType, pos.id, file);
                    e.target.value = '';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const EditButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="ml-auto text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
      Edit
    </button>
  );

  // Collapsible wrapper for Cockpit mode
  if (collapsible) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        {/* Collapsible Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
          onClick={toggleCollapse}
        >
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Patient Intake Data
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                submission.status === "completed"
                  ? "bg-emerald-100 text-emerald-700"
                  : submission.status === "in_progress"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {submission.status === "completed" ? "Completed" : submission.status === "in_progress" ? "In Progress" : submission.status}
            </span>
            <button
              type="button"
              className="p-1 rounded hover:bg-slate-100 transition-colors"
              onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
            >
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {!collapsed && (
          <div className="px-4 pb-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 flex gap-4 py-3">
              <span>Started: {new Date(submission.started_at).toLocaleDateString()}</span>
              {submission.completed_at && (
                <span>Completed: {new Date(submission.completed_at).toLocaleDateString()}</span>
              )}
            </div>
            {renderContent()}
          </div>
        )}
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

      {renderContent()}
    </div>
  );

  // Extracted content for reuse
  function renderContent() {
    return (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Preferences Card - Always show */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900">Preferences</h4>
            <EditButton onClick={() => {
              setEditPrefs(preferences || { preferred_language: "en", consultation_type: "either", preferred_contact_method: "email", preferred_contact_time: "anytime", additional_notes: null });
              setEditingSection("preferences");
            }} />
          </div>
          
          {editingSection === "preferences" && editPrefs ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Language</label>
                <select value={editPrefs.preferred_language} onChange={(e) => setEditPrefs({ ...editPrefs, preferred_language: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                  <option value="ru">Russian</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Consultation Type</label>
                <select value={editPrefs.consultation_type} onChange={(e) => setEditPrefs({ ...editPrefs, consultation_type: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                  <option value="in-person">In Person</option>
                  <option value="virtual">Virtual</option>
                  <option value="either">Either</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Contact Method</label>
                <select value={editPrefs.preferred_contact_method} onChange={(e) => setEditPrefs({ ...editPrefs, preferred_contact_method: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Best Time</label>
                <select value={editPrefs.preferred_contact_time} onChange={(e) => setEditPrefs({ ...editPrefs, preferred_contact_time: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Notes</label>
                <textarea value={editPrefs.additional_notes || ""} onChange={(e) => setEditPrefs({ ...editPrefs, additional_notes: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => savePreferences(editPrefs)} disabled={saving} className="px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setEditingSection(null)} className="px-4 py-2 text-slate-600 text-xs hover:bg-slate-100 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : preferences ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Language</span><span className="text-slate-900 font-medium">{LANGUAGE_LABELS[preferences.preferred_language] || preferences.preferred_language}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Consultation</span><span className="text-slate-900 font-medium capitalize">{preferences.consultation_type}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Contact via</span><span className="text-slate-900 font-medium capitalize">{preferences.preferred_contact_method}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Best time</span><span className="text-slate-900 font-medium capitalize">{preferences.preferred_contact_time}</span></div>
              {preferences.additional_notes && <div className="pt-2 border-t border-slate-100"><span className="text-slate-500 text-xs">Notes:</span><p className="text-slate-700 mt-1">{preferences.additional_notes}</p></div>}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No preferences set. Click Edit to add.</p>
          )}
        </div>

        {/* Treatment Areas Card - Shows consultation data */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900">Treatment Areas</h4>
            <EditButton onClick={() => {
              // Initialize with existing data
              const lipoData = consultationData.find(c => c.consultation_type === "liposuction");
              const faceData = consultationData.find(c => c.consultation_type === "face");
              const breastData = consultationData.find(c => c.consultation_type === "breast");
              
              // Set treatment areas
              setEditTreatmentAreas({
                liposuction: lipoData?.selected_areas || [],
                face: ((faceData?.face_data as Record<string, unknown>)?.priority_areas as string[]) || [],
                breast: ((breastData?.breast_data as Record<string, unknown>)?.procedure_types as string[]) || [],
              });
              
              // Initialize liposuction measurements
              if (lipoData?.measurements) {
                setLipoMeasurements(lipoData.measurements as Record<string, string>);
              }
              
              // Initialize face form fields
              if (faceData?.face_data) {
                const fd = faceData.face_data as Record<string, unknown>;
                setFaceHadTreatments((fd.had_treatments as "yes" | "no") || null);
                setFaceTreatmentKind((fd.treatment_kind as string) || "");
                setFaceTreatmentWhen((fd.treatment_when as string) || "");
                setFaceEffects((fd.effects as string[]) || []);
                setFaceBudget((fd.budget as string) || "");
              }
              
              // Initialize breast form fields
              if (breastData?.breast_data) {
                const bd = breastData.breast_data as Record<string, unknown>;
                setBreastHadSurgery((bd.had_surgery as "yes" | "no") || null);
                setBreastSurgeryTypes((bd.surgery_types as string[]) || []);
                setBreastHadBreastfeed((bd.had_breastfeed as "yes" | "no") || null);
                setBreastfeedHowLong((bd.breastfeed_how_long as string) || "");
                setBreastHadConditions((bd.had_conditions as "yes" | "no") || null);
                setBreastConditionsDetails((bd.conditions_details as string) || "");
                setBreastHadUltrasound((bd.had_ultrasound as "yes" | "no") || null);
                setBreastUltrasoundHowLong((bd.ultrasound_how_long as string) || "");
                setBreastUltrasoundWhy((bd.ultrasound_why as string) || "");
                setBreastHadPreviousConsult((bd.had_previous_consultation as "yes" | "no") || null);
                setBreastAugmentationOption((bd.augmentation_option as string) || "");
                setBreastDesiredCupSize((bd.desired_cup_size as string) || "");
                setBreastReductionComments((bd.reduction_comments as string) || "");
                setBreastLiftComments((bd.lift_comments as string) || "");
              }
              if (breastData?.measurements) {
                setBreastMeasurements(breastData.measurements as Record<string, string>);
              }
              
              setEditingSection("treatment_areas");
            }} />
          </div>
          
          {editingSection === "treatment_areas" ? (
            <div className="space-y-4">
              {/* Consultation Type Selector */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">Select Consultation Type</label>
                <div className="flex flex-wrap gap-2">
                  {CONSULTATION_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setActiveConsultationType(activeConsultationType === type.id ? null : type.id)}
                      className={`px-4 py-2 text-sm rounded-lg border-2 transition-all flex items-center gap-2 ${
                        activeConsultationType === type.id
                          ? type.color === "rose" ? "bg-rose-500 text-white border-rose-500"
                          : type.color === "sky" ? "bg-sky-500 text-white border-sky-500"
                          : "bg-purple-500 text-white border-purple-500"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                      {((type.id === "liposuction" && editTreatmentAreas.liposuction.length > 0) ||
                        (type.id === "face" && editTreatmentAreas.face.length > 0) ||
                        (type.id === "breast" && editTreatmentAreas.breast.length > 0)) && (
                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* LIPOSUCTION FORM */}
              {activeConsultationType === "liposuction" && (
                <div className="border-l-4 border-rose-400 pl-4 space-y-4 bg-rose-50/30 py-3 rounded-r-lg">
                  <h5 className="font-medium text-slate-800 flex items-center gap-2">🏃 Liposuction / Body Consultation</h5>
                  
                  {/* Area Selection */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Select Treatment Areas</label>
                    <div className="flex flex-wrap gap-2">
                      {LIPOSUCTION_AREAS.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => setEditTreatmentAreas(prev => ({
                            ...prev,
                            liposuction: prev.liposuction.includes(area) 
                              ? prev.liposuction.filter(a => a !== area)
                              : [...prev.liposuction, area]
                          }))}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            editTreatmentAreas.liposuction.includes(area)
                              ? "bg-rose-500 text-white border-rose-500"
                              : "bg-white text-slate-600 border-slate-200 hover:border-rose-300"
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Measurements based on selected areas */}
                  {editTreatmentAreas.liposuction.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-2 block">Measurements (cm)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {editTreatmentAreas.liposuction.flatMap(area => 
                          (AREA_MEASUREMENTS[area] || []).map(field => (
                            <div key={field}>
                              <label className="text-xs text-slate-500">{field}</label>
                              <input
                                type="number"
                                value={lipoMeasurements[field] || ""}
                                onChange={(e) => setLipoMeasurements(prev => ({...prev, [field]: e.target.value}))}
                                className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-black"
                                placeholder="cm"
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Photo Upload */}
                  {renderPhotoUploadSection("liposuction", LIPOSUCTION_PHOTO_POSITIONS)}
                </div>
              )}

              {/* FACE FORM */}
              {activeConsultationType === "face" && (
                <div className="border-l-4 border-sky-400 pl-4 space-y-4 bg-sky-50/30 py-3 rounded-r-lg">
                  <h5 className="font-medium text-slate-800 flex items-center gap-2">👤 Face Consultation</h5>
                  
                  {/* Previous Treatments */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Have you had facial treatments before?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFaceHadTreatments("yes")} className={`px-4 py-1.5 text-xs rounded-lg border ${faceHadTreatments === "yes" ? "bg-sky-500 text-white border-sky-500" : "bg-white border-slate-200"}`}>Yes</button>
                      <button type="button" onClick={() => setFaceHadTreatments("no")} className={`px-4 py-1.5 text-xs rounded-lg border ${faceHadTreatments === "no" ? "bg-sky-500 text-white border-sky-500" : "bg-white border-slate-200"}`}>No</button>
                    </div>
                  </div>

                  {faceHadTreatments === "yes" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500">What kind of treatment?</label>
                        <input type="text" value={faceTreatmentKind} onChange={(e) => setFaceTreatmentKind(e.target.value)} className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-black" placeholder="e.g., Botox, Filler" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">When?</label>
                        <input type="text" value={faceTreatmentWhen} onChange={(e) => setFaceTreatmentWhen(e.target.value)} className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-black" placeholder="e.g., 6 months ago" />
                      </div>
                    </div>
                  )}

                  {/* Desired Effects */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Desired Effects</label>
                    <div className="flex flex-wrap gap-2">
                      {FACE_EFFECTS.map((effect) => (
                        <button
                          key={effect}
                          type="button"
                          onClick={() => setFaceEffects(prev => prev.includes(effect) ? prev.filter(e => e !== effect) : [...prev, effect])}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            faceEffects.includes(effect) ? "bg-sky-500 text-white border-sky-500" : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                          }`}
                        >
                          {effect}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority Areas */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Priority Areas</label>
                    <div className="flex flex-wrap gap-2">
                      {FACE_PRIORITY_AREAS.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => setEditTreatmentAreas(prev => ({
                            ...prev,
                            face: prev.face.includes(area) ? prev.face.filter(a => a !== area) : [...prev.face, area]
                          }))}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            editTreatmentAreas.face.includes(area) ? "bg-sky-500 text-white border-sky-500" : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Budget Range</label>
                    <div className="flex flex-wrap gap-2">
                      {FACE_BUDGET_OPTIONS.map((budget) => (
                        <button
                          key={budget}
                          type="button"
                          onClick={() => setFaceBudget(budget)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            faceBudget === budget ? "bg-sky-500 text-white border-sky-500" : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                          }`}
                        >
                          {budget}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Photo Upload */}
                  {renderPhotoUploadSection("face", FACE_PHOTO_POSITIONS)}
                </div>
              )}

              {/* BREAST FORM */}
              {activeConsultationType === "breast" && (
                <div className="border-l-4 border-purple-400 pl-4 space-y-4 bg-purple-50/30 py-3 rounded-r-lg">
                  <h5 className="font-medium text-slate-800 flex items-center gap-2">💜 Breast Consultation</h5>
                  
                  {/* Procedure Types */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Procedure Type(s)</label>
                    <div className="flex flex-wrap gap-2">
                      {BREAST_PROCEDURE_TYPES.map((proc) => (
                        <button
                          key={proc}
                          type="button"
                          onClick={() => setEditTreatmentAreas(prev => ({
                            ...prev,
                            breast: prev.breast.includes(proc) ? prev.breast.filter(p => p !== proc) : [...prev.breast, proc]
                          }))}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            editTreatmentAreas.breast.includes(proc) ? "bg-purple-500 text-white border-purple-500" : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
                          }`}
                        >
                          {proc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Augmentation specific */}
                  {editTreatmentAreas.breast.includes("Breast Augmentation") && (
                    <div className="bg-purple-50 p-3 rounded-lg space-y-3">
                      <p className="text-xs font-medium text-purple-700">Augmentation Details</p>
                      <div>
                        <label className="text-xs text-slate-500">Preferred Method</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {AUGMENTATION_OPTIONS.map((opt) => (
                            <button key={opt} type="button" onClick={() => setBreastAugmentationOption(opt)}
                              className={`px-3 py-1 text-xs rounded border ${breastAugmentationOption === opt ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Desired Cup Size</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {CUP_SIZES.map((size) => (
                            <button key={size} type="button" onClick={() => setBreastDesiredCupSize(size)}
                              className={`px-3 py-1 text-xs rounded border ${breastDesiredCupSize === size ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reduction specific */}
                  {editTreatmentAreas.breast.includes("Breast Reduction") && (
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <label className="text-xs text-slate-500">Reduction Comments</label>
                      <textarea value={breastReductionComments} onChange={(e) => setBreastReductionComments(e.target.value)} className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-black" rows={2} placeholder="Any specific concerns or goals..." />
                    </div>
                  )}

                  {/* Lift specific */}
                  {editTreatmentAreas.breast.includes("Breast Lift") && (
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <label className="text-xs text-slate-500">Lift Comments</label>
                      <textarea value={breastLiftComments} onChange={(e) => setBreastLiftComments(e.target.value)} className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-black" rows={2} placeholder="Any specific concerns or goals..." />
                    </div>
                  )}

                  {/* Medical History */}
                  <div className="border-t border-purple-200 pt-3">
                    <p className="text-xs font-medium text-slate-600 mb-3">Medical History</p>
                    
                    {/* Previous Breast Surgery */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-500">Have you had breast surgery before?</label>
                      <div className="flex gap-2 mt-1">
                        <button type="button" onClick={() => setBreastHadSurgery("yes")} className={`px-4 py-1 text-xs rounded border ${breastHadSurgery === "yes" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>Yes</button>
                        <button type="button" onClick={() => setBreastHadSurgery("no")} className={`px-4 py-1 text-xs rounded border ${breastHadSurgery === "no" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>No</button>
                      </div>
                    </div>

                    {breastHadSurgery === "yes" && (
                      <div className="mb-3 ml-3 border-l-2 border-purple-200 pl-3">
                        <label className="text-xs text-slate-500">Type of surgery</label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {BREAST_SURGERY_TYPES.map((type) => (
                            <button key={type} type="button" onClick={() => setBreastSurgeryTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                              className={`px-2 py-0.5 text-xs rounded border ${breastSurgeryTypes.includes(type) ? "bg-purple-400 text-white border-purple-400" : "bg-white border-slate-200"}`}>
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Breastfeeding */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-500">Have you breastfed?</label>
                      <div className="flex gap-2 mt-1">
                        <button type="button" onClick={() => setBreastHadBreastfeed("yes")} className={`px-4 py-1 text-xs rounded border ${breastHadBreastfeed === "yes" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>Yes</button>
                        <button type="button" onClick={() => setBreastHadBreastfeed("no")} className={`px-4 py-1 text-xs rounded border ${breastHadBreastfeed === "no" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>No</button>
                      </div>
                      {breastHadBreastfeed === "yes" && (
                        <input type="text" value={breastfeedHowLong} onChange={(e) => setBreastfeedHowLong(e.target.value)} className="mt-2 w-full px-2 py-1 border border-slate-300 rounded text-sm text-black" placeholder="For how long?" />
                      )}
                    </div>

                    {/* Breast Conditions */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-500">Any breast conditions (cysts, lumps, etc.)?</label>
                      <div className="flex gap-2 mt-1">
                        <button type="button" onClick={() => setBreastHadConditions("yes")} className={`px-4 py-1 text-xs rounded border ${breastHadConditions === "yes" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>Yes</button>
                        <button type="button" onClick={() => setBreastHadConditions("no")} className={`px-4 py-1 text-xs rounded border ${breastHadConditions === "no" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>No</button>
                      </div>
                      {breastHadConditions === "yes" && (
                        <input type="text" value={breastConditionsDetails} onChange={(e) => setBreastConditionsDetails(e.target.value)} className="mt-2 w-full px-2 py-1 border border-slate-300 rounded text-sm text-black" placeholder="Please describe..." />
                      )}
                    </div>

                    {/* Ultrasound */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-500">Have you had a breast ultrasound/mammogram?</label>
                      <div className="flex gap-2 mt-1">
                        <button type="button" onClick={() => setBreastHadUltrasound("yes")} className={`px-4 py-1 text-xs rounded border ${breastHadUltrasound === "yes" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>Yes</button>
                        <button type="button" onClick={() => setBreastHadUltrasound("no")} className={`px-4 py-1 text-xs rounded border ${breastHadUltrasound === "no" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>No</button>
                      </div>
                      {breastHadUltrasound === "yes" && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input type="text" value={breastUltrasoundHowLong} onChange={(e) => setBreastUltrasoundHowLong(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm text-black" placeholder="How long ago?" />
                          <input type="text" value={breastUltrasoundWhy} onChange={(e) => setBreastUltrasoundWhy(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm text-black" placeholder="Reason?" />
                        </div>
                      )}
                    </div>

                    {/* Previous Consultation */}
                    <div>
                      <label className="text-xs text-slate-500">Have you had a breast consultation before?</label>
                      <div className="flex gap-2 mt-1">
                        <button type="button" onClick={() => setBreastHadPreviousConsult("yes")} className={`px-4 py-1 text-xs rounded border ${breastHadPreviousConsult === "yes" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>Yes</button>
                        <button type="button" onClick={() => setBreastHadPreviousConsult("no")} className={`px-4 py-1 text-xs rounded border ${breastHadPreviousConsult === "no" ? "bg-purple-500 text-white border-purple-500" : "bg-white border-slate-200"}`}>No</button>
                      </div>
                    </div>
                  </div>

                  {/* Breast Measurements */}
                  <div className="border-t border-purple-200 pt-3">
                    <p className="text-xs font-medium text-slate-600 mb-3">Breast Measurements (cm)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {BREAST_MEASUREMENTS_FIELDS.map((m) => (
                        <div key={m.id} className={m.id === "inter_nipple" ? "col-span-2" : ""}>
                          <label className="text-xs text-slate-500">
                            {m.required && <span className="text-red-500">* </span>}{m.label}
                          </label>
                          <input
                            type="number"
                            value={breastMeasurements[m.id] || ""}
                            onChange={(e) => setBreastMeasurements(prev => ({...prev, [m.id]: e.target.value}))}
                            className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-black"
                            placeholder="cm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Photo Upload */}
                  {renderPhotoUploadSection("breast", BREAST_PHOTO_POSITIONS)}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => saveTreatmentAreas(editTreatmentAreas)} disabled={saving} className="px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => { setEditingSection(null); setActiveConsultationType(null); }} className="px-4 py-2 text-slate-600 text-xs hover:bg-slate-100 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : consultationData.length > 0 ? (
            <div className="space-y-4">
              {consultationData.map((consultation) => (
                <div key={consultation.id} className="border-l-2 border-rose-300 pl-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-slate-900 capitalize">{consultation.consultation_type} Consultation</span>
                    <span className="text-xs text-white bg-rose-500 px-2 py-0.5 rounded-full">
                      {consultation.upload_mode === "now" ? "Photos Uploaded" : "Photos Pending"}
                    </span>
                  </div>
                  
                  {/* Liposuction: show selected areas */}
                  {consultation.consultation_type === "liposuction" && consultation.selected_areas && (
                    <div className="mb-2">
                      <span className="text-xs text-slate-500">Selected Areas:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {consultation.selected_areas.map((area: string) => (
                          <span key={area} className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">{area}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Breast: show ALL procedure types and details */}
                  {consultation.consultation_type === "breast" && consultation.breast_data && (() => {
                    const bd = consultation.breast_data as Record<string, unknown>;
                    const procTypes = (bd.procedure_types as string[]) || [];
                    const augOpt = bd.augmentation_option ? String(bd.augmentation_option) : null;
                    const cupSize = bd.desired_cup_size ? String(bd.desired_cup_size) : null;
                    const surgTypes = (bd.surgery_types as string[]) || [];
                    const bfLong = bd.breastfeed_how_long ? String(bd.breastfeed_how_long) : null;
                    const condDetails = bd.conditions_details ? String(bd.conditions_details) : null;
                    const usLong = bd.ultrasound_how_long ? String(bd.ultrasound_how_long) : null;
                    const usWhy = bd.ultrasound_why ? String(bd.ultrasound_why) : null;
                    const reductionComments = bd.reduction_comments ? String(bd.reduction_comments) : null;
                    const liftComments = bd.lift_comments ? String(bd.lift_comments) : null;
                    const hadPrevConsult = bd.had_previous_consultation as string | null;
                    
                    return (
                      <div className="space-y-2">
                        {/* Procedure Types */}
                        {procTypes.length > 0 && (
                          <div>
                            <span className="text-xs text-slate-500">Procedure Types:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {procTypes.map((proc: string) => (
                                <span key={proc} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{proc}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Augmentation Details */}
                        {augOpt && (
                          <div className="text-xs text-slate-600">
                            <span className="text-slate-500">Augmentation Method:</span> {augOpt}
                            {cupSize && <> • <span className="text-slate-500">Desired Cup Size:</span> {cupSize}</>}
                          </div>
                        )}
                        
                        {/* Reduction Comments */}
                        {reductionComments && (
                          <div className="text-xs text-slate-600">
                            <span className="text-slate-500">Reduction Notes:</span> {reductionComments}
                          </div>
                        )}
                        
                        {/* Lift Comments */}
                        {liftComments && (
                          <div className="text-xs text-slate-600">
                            <span className="text-slate-500">Lift Notes:</span> {liftComments}
                          </div>
                        )}
                        
                        {/* Medical History Section */}
                        {(() => {
                          const hadSurg = bd.had_surgery ? String(bd.had_surgery) : null;
                          const hadBf = bd.had_breastfeed ? String(bd.had_breastfeed) : null;
                          const hadCond = bd.had_conditions ? String(bd.had_conditions) : null;
                          const hadUs = bd.had_ultrasound ? String(bd.had_ultrasound) : null;
                          
                          if (!hadSurg && !hadBf && !hadCond && !hadUs && !hadPrevConsult) return null;
                          
                          return (
                            <div className="mt-2 pt-2 border-t border-purple-100">
                              <span className="text-xs font-medium text-slate-600 block mb-1">Medical History</span>
                              
                              {hadSurg && (
                                <div className="text-xs text-slate-600">
                                  <span className="text-slate-500">Previous Breast Surgery:</span> {hadSurg === "yes" ? "Yes" : "No"}
                                  {hadSurg === "yes" && surgTypes.length > 0 && ` (${surgTypes.join(", ")})`}
                                </div>
                              )}
                              
                              {hadBf && (
                                <div className="text-xs text-slate-600">
                                  <span className="text-slate-500">Breastfed:</span> {hadBf === "yes" ? "Yes" : "No"}
                                  {hadBf === "yes" && bfLong && ` (${bfLong})`}
                                </div>
                              )}
                              
                              {hadCond && (
                                <div className="text-xs text-slate-600">
                                  <span className="text-slate-500">Breast Conditions:</span> {hadCond === "yes" ? "Yes" : "No"}
                                  {hadCond === "yes" && condDetails && ` - ${condDetails}`}
                                </div>
                              )}
                              
                              {hadUs && (
                                <div className="text-xs text-slate-600">
                                  <span className="text-slate-500">Ultrasound/Mammogram:</span> {hadUs === "yes" ? "Yes" : "No"}
                                  {hadUs === "yes" && usLong && ` (${usLong})`}
                                  {hadUs === "yes" && usWhy && ` - ${usWhy}`}
                                </div>
                              )}
                              
                              {hadPrevConsult && (
                                <div className="text-xs text-slate-600">
                                  <span className="text-slate-500">Previous Consultation:</span> {hadPrevConsult === "yes" ? "Yes" : "No"}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Face: show ALL face data */}
                  {consultation.consultation_type === "face" && consultation.face_data && (() => {
                    const fd = consultation.face_data as Record<string, unknown>;
                    const effects = (fd.effects as string[]) || [];
                    const priorityAreas = (fd.priority_areas as string[]) || [];
                    const budget = fd.budget ? String(fd.budget) : null;
                    const hadTreatments = fd.had_treatments as string | null;
                    const treatmentKind = fd.treatment_kind ? String(fd.treatment_kind) : null;
                    const treatmentWhen = fd.treatment_when ? String(fd.treatment_when) : null;
                    
                    return (
                      <div className="space-y-2">
                        {/* Previous Treatments */}
                        {hadTreatments && (
                          <div className="text-xs text-slate-600">
                            <span className="text-slate-500">Previous Facial Treatments:</span> {hadTreatments === "yes" ? "Yes" : "No"}
                            {hadTreatments === "yes" && treatmentKind && ` - ${treatmentKind}`}
                            {hadTreatments === "yes" && treatmentWhen && ` (${treatmentWhen})`}
                          </div>
                        )}
                        
                        {/* Desired Effects */}
                        {effects.length > 0 && (
                          <div>
                            <span className="text-xs text-slate-500">Desired Effects:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {effects.map((effect: string) => (
                                <span key={effect} className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">{effect}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Priority Areas */}
                        {priorityAreas.length > 0 && (
                          <div>
                            <span className="text-xs text-slate-500">Priority Areas:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {priorityAreas.map((area: string) => (
                                <span key={area} className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">{area}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Budget */}
                        {budget && (
                          <div className="text-xs text-slate-600">
                            <span className="text-slate-500">Budget:</span> {budget}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Measurements - show ALL */}
                  {consultation.measurements && Object.keys(consultation.measurements).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">Measurements:</span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs">
                        {Object.entries(consultation.measurements).map(([key, value]) => (
                          <div key={key} className="text-slate-600 flex justify-between">
                            <span className="capitalize text-slate-500">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">{value}cm</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : treatmentAreas.length > 0 ? (
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
                        <span key={concern} className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">{concern}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No treatment areas selected. Click Edit to add.</p>
          )}
        </div>

        {/* Treatment Preferences Card - Always show */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900">Treatment Preferences</h4>
            <EditButton onClick={() => {
              setEditTreatmentPrefs(treatmentPrefs || { preferred_date_range_start: null, preferred_date_range_end: null, flexibility: "flexible", budget_range: "standard", financing_interest: false, special_requests: null });
              setEditingSection("treatment_prefs");
            }} />
          </div>
          
          {editingSection === "treatment_prefs" && editTreatmentPrefs ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Start Date</label>
                  <input type="date" value={editTreatmentPrefs.preferred_date_range_start || ""} onChange={(e) => setEditTreatmentPrefs({ ...editTreatmentPrefs, preferred_date_range_start: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">End Date</label>
                  <input type="date" value={editTreatmentPrefs.preferred_date_range_end || ""} onChange={(e) => setEditTreatmentPrefs({ ...editTreatmentPrefs, preferred_date_range_end: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Flexibility</label>
                <select value={editTreatmentPrefs.flexibility} onChange={(e) => setEditTreatmentPrefs({ ...editTreatmentPrefs, flexibility: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                  <option value="flexible">Flexible</option>
                  <option value="specific_dates">Specific Dates</option>
                  <option value="asap">ASAP</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Budget Range</label>
                <select value={editTreatmentPrefs.budget_range} onChange={(e) => setEditTreatmentPrefs({ ...editTreatmentPrefs, budget_range: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                  <option value="economy">Economy</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="no_limit">No Limit</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="financing_edit" checked={editTreatmentPrefs.financing_interest} onChange={(e) => setEditTreatmentPrefs({ ...editTreatmentPrefs, financing_interest: e.target.checked })} className="w-4 h-4" />
                <label htmlFor="financing_edit" className="text-sm text-slate-600">Interested in financing</label>
              </div>
              <div>
                <label className="text-xs text-slate-500">Special Requests</label>
                <textarea value={editTreatmentPrefs.special_requests || ""} onChange={(e) => setEditTreatmentPrefs({ ...editTreatmentPrefs, special_requests: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => saveTreatmentPrefs(editTreatmentPrefs)} disabled={saving} className="px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setEditingSection(null)} className="px-4 py-2 text-slate-600 text-xs hover:bg-slate-100 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : treatmentPrefs ? (
            <div className="space-y-2 text-sm">
              {(treatmentPrefs.preferred_date_range_start || treatmentPrefs.preferred_date_range_end) && <div className="flex justify-between"><span className="text-slate-500">Preferred dates</span><span className="text-slate-900 font-medium">{treatmentPrefs.preferred_date_range_start && new Date(treatmentPrefs.preferred_date_range_start).toLocaleDateString()}{treatmentPrefs.preferred_date_range_start && treatmentPrefs.preferred_date_range_end && " - "}{treatmentPrefs.preferred_date_range_end && new Date(treatmentPrefs.preferred_date_range_end).toLocaleDateString()}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Flexibility</span><span className="text-slate-900 font-medium capitalize">{treatmentPrefs.flexibility.replace("_", " ")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Budget</span><span className="text-slate-900 font-medium capitalize">{treatmentPrefs.budget_range.replace("_", " ")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Financing interest</span><span className={`font-medium ${treatmentPrefs.financing_interest ? "text-emerald-600" : "text-slate-400"}`}>{treatmentPrefs.financing_interest ? "Yes" : "No"}</span></div>
              {treatmentPrefs.special_requests && <div className="pt-2 border-t border-slate-100"><span className="text-slate-500 text-xs">Special requests:</span><p className="text-slate-700 mt-1">{treatmentPrefs.special_requests}</p></div>}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No treatment preferences set. Click Edit to add.</p>
          )}
        </div>

        {/* Insurance Card - Editable */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900">Insurance Information</h4>
            <EditButton onClick={() => {
              setEditInsurance(insurance || { provider_name: "", card_number: "", insurance_type: "" });
              setEditingSection("insurance");
            }} />
          </div>
          
          {editingSection === "insurance" && editInsurance ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Provider Name</label>
                <input type="text" value={editInsurance.provider_name || ""} onChange={(e) => setEditInsurance({ ...editInsurance, provider_name: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" placeholder="Insurance Provider" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Card Number</label>
                <input type="text" value={editInsurance.card_number || ""} onChange={(e) => setEditInsurance({ ...editInsurance, card_number: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" placeholder="Card Number" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Insurance Type</label>
                <select value={editInsurance.insurance_type || ""} onChange={(e) => setEditInsurance({ ...editInsurance, insurance_type: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                  <option value="">Select Type</option>
                  <option value="private">Private</option>
                  <option value="semi-private">Semi-Private</option>
                  <option value="basic">Basic</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => saveInsurance(editInsurance)} disabled={saving} className="px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setEditingSection(null)} className="px-4 py-2 text-slate-600 text-xs hover:bg-slate-100 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : insurance ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Provider</span><span className="text-slate-900 font-medium">{insurance.provider_name || "N/A"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Card Number</span><span className="text-slate-900 font-medium">{insurance.card_number || "N/A"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-900 font-medium">{insurance.insurance_type || "N/A"}</span></div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No insurance information provided. Click Edit to add.</p>
          )}
        </div>

        {/* Health Background Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900">Health Background & Lifestyle</h4>
            <EditButton onClick={() => {
              setEditHealthBackground(healthBackground || {
                weight_kg: null, height_cm: null, bmi: null,
                known_illnesses: null, previous_surgeries: null, allergies: null,
                cigarettes: null, alcohol_consumption: null, sports_activity: null,
                medications: null, general_practitioner: null, gynecologist: null,
                children_count: null, birth_type_1: null, birth_type_2: null
              });
              setEditingSection("health_background");
            }} />
          </div>
          
          {editingSection === "health_background" && editHealthBackground ? (
            <div className="space-y-4">
              {/* Physical Measurements with BMI Calculator */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Physical Measurements & BMI Calculator</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Weight (kg)</label>
                    <input type="number" value={editHealthBackground.weight_kg || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, weight_kg: e.target.value ? parseFloat(e.target.value) : null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" placeholder="e.g., 70" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Height (cm)</label>
                    <input type="number" value={editHealthBackground.height_cm || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, height_cm: e.target.value ? parseFloat(e.target.value) : null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" placeholder="e.g., 170" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">BMI (auto-calculated)</label>
                    {(() => {
                      const liveBmi = calculateBMI(editHealthBackground.height_cm, editHealthBackground.weight_kg);
                      const category = liveBmi ? getBMICategory(liveBmi) : null;
                      return (
                        <div className={`mt-1 px-3 py-2 rounded-lg text-sm font-medium text-center ${category ? category.color : "bg-slate-100 text-slate-400"}`}>
                          {liveBmi ? `${liveBmi} - ${category?.label}` : "Enter weight & height"}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Interactive BMI Scale */}
                {editHealthBackground.weight_kg && editHealthBackground.height_cm && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>Underweight</span>
                      <span>Normal</span>
                      <span>Overweight</span>
                      <span>Obese</span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 via-emerald-400 via-amber-400 to-red-400">
                      {(() => {
                        const bmi = calculateBMI(editHealthBackground.height_cm, editHealthBackground.weight_kg);
                        if (!bmi) return null;
                        // BMI scale: 15 to 40, position marker
                        const position = Math.min(Math.max((bmi - 15) / 25 * 100, 0), 100);
                        return (
                          <div 
                            className="absolute top-0 w-1 h-full bg-slate-900 shadow-lg transition-all duration-300"
                            style={{ left: `${position}%`, transform: "translateX(-50%)" }}
                          >
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                              {bmi}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>15</span>
                      <span>18.5</span>
                      <span>25</span>
                      <span>30</span>
                      <span>40</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Medical History */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Medical History</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Known Illnesses</label>
                    <textarea value={editHealthBackground.known_illnesses || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, known_illnesses: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" rows={2} placeholder="List any illnesses" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Previous Surgeries</label>
                    <textarea value={editHealthBackground.previous_surgeries || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, previous_surgeries: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" rows={2} placeholder="List any surgeries" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Allergies</label>
                    <textarea value={editHealthBackground.allergies || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, allergies: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" rows={2} placeholder="List any allergies" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Current Medications</label>
                    <textarea value={editHealthBackground.medications || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, medications: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" rows={2} placeholder="List any medications" />
                  </div>
                </div>
              </div>

              {/* Lifestyle */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Lifestyle</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Cigarettes</label>
                    <select value={editHealthBackground.cigarettes || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, cigarettes: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                      <option value="">Select</option>
                      {ALCOHOL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Alcohol</label>
                    <select value={editHealthBackground.alcohol_consumption || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, alcohol_consumption: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                      <option value="">Select</option>
                      {ALCOHOL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Sports</label>
                    <select value={editHealthBackground.sports_activity || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, sports_activity: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                      <option value="">Select</option>
                      {SPORTS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Healthcare Providers */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Healthcare Providers</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">General Practitioner</label>
                    <input type="text" value={editHealthBackground.general_practitioner || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, general_practitioner: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" placeholder="Doctor's name" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Gynecologist</label>
                    <input type="text" value={editHealthBackground.gynecologist || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, gynecologist: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" placeholder="Doctor's name" />
                  </div>
                </div>
              </div>

              {/* Children */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Children</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Number of Children</label>
                    <input type="number" min="0" value={editHealthBackground.children_count || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, children_count: e.target.value ? parseInt(e.target.value) : null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Birth 1 Type</label>
                    <select value={editHealthBackground.birth_type_1 || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, birth_type_1: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                      <option value="">Select</option>
                      {BIRTH_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Birth 2 Type</label>
                    <select value={editHealthBackground.birth_type_2 || ""} onChange={(e) => setEditHealthBackground({ ...editHealthBackground, birth_type_2: e.target.value || null })} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-black">
                      <option value="">Select</option>
                      {BIRTH_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => saveHealthBackground(editHealthBackground)} disabled={saving} className="px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setEditingSection(null)} className="px-4 py-2 text-slate-600 text-xs hover:bg-slate-100 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : healthBackground ? (
            <div className="space-y-4">
              {/* BMI Highlight Card */}
              {healthBackground.bmi && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Body Mass Index (BMI)</span>
                    {(() => {
                      const category = getBMICategory(healthBackground.bmi);
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${category.color}`}>
                          {category.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold text-slate-900">{healthBackground.bmi}</span>
                    <span className="text-sm text-slate-500 mb-1">kg/m²</span>
                  </div>
                  {/* Mini BMI Scale */}
                  <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 via-emerald-400 via-amber-400 to-red-400">
                    {(() => {
                      const position = Math.min(Math.max((healthBackground.bmi - 15) / 25 * 100, 0), 100);
                      return (
                        <div 
                          className="absolute top-0 w-1 h-full bg-slate-900 rounded-full shadow-lg"
                          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                    <span>15</span>
                    <span>18.5</span>
                    <span>25</span>
                    <span>30</span>
                    <span>40</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-1">Physical</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Weight</span><span className="text-slate-900 font-medium">{healthBackground.weight_kg ? `${healthBackground.weight_kg} kg` : "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Height</span><span className="text-slate-900 font-medium">{healthBackground.height_cm ? `${healthBackground.height_cm} cm` : "N/A"}</span></div>
                </div>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Medical History</p>
                <div className="space-y-1">
                  <div><span className="text-slate-500">Illnesses:</span> <span className="text-slate-900">{healthBackground.known_illnesses || "N/A"}</span></div>
                  <div><span className="text-slate-500">Surgeries:</span> <span className="text-slate-900">{healthBackground.previous_surgeries || "N/A"}</span></div>
                  <div><span className="text-slate-500">Allergies:</span> <span className="text-slate-900">{healthBackground.allergies || "N/A"}</span></div>
                  <div><span className="text-slate-500">Medications:</span> <span className="text-slate-900">{healthBackground.medications || "N/A"}</span></div>
                </div>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Lifestyle</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Cigarettes</span><span className="text-slate-900 font-medium">{healthBackground.cigarettes || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Alcohol</span><span className="text-slate-900 font-medium">{healthBackground.alcohol_consumption || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sports</span><span className="text-slate-900 font-medium">{healthBackground.sports_activity || "N/A"}</span></div>
                </div>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Healthcare Providers</p>
                <div className="space-y-1">
                  <div><span className="text-slate-500">GP:</span> <span className="text-slate-900">{healthBackground.general_practitioner || "N/A"}</span></div>
                  <div><span className="text-slate-500">Gynecologist:</span> <span className="text-slate-900">{healthBackground.gynecologist || "N/A"}</span></div>
                </div>
              </div>
              {healthBackground.children_count && healthBackground.children_count > 0 && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Children</p>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Count</span><span className="text-slate-900 font-medium">{healthBackground.children_count}</span></div>
                    {healthBackground.birth_type_1 && <div className="flex justify-between"><span className="text-slate-500">Birth 1</span><span className="text-slate-900 font-medium">{healthBackground.birth_type_1}</span></div>}
                    {healthBackground.birth_type_2 && <div className="flex justify-between"><span className="text-slate-500">Birth 2</span><span className="text-slate-900 font-medium">{healthBackground.birth_type_2}</span></div>}
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No health background information provided. Click Edit to add.</p>
          )}
        </div>
      </div>

      {/* Photos Section - Always show */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="font-medium text-slate-900">Uploaded Photos</h4>
          <span className="text-xs text-slate-400">({photos.length + consultationPhotos.length})</span>
        </div>
        
        {/* Consultation Photos by Type */}
        {consultationPhotos.length > 0 && (
          <div className="mb-4">
            {["liposuction", "face", "breast"].map(consultType => {
              const typePhotos = consultationPhotos.filter(p => p.consultationType === consultType);
              if (typePhotos.length === 0) return null;
              return (
                <div key={consultType} className="mb-4">
                  <p className="text-xs font-medium text-slate-600 mb-2 capitalize flex items-center gap-1">
                    {consultType === "liposuction" && "🏃"}
                    {consultType === "face" && "👤"}
                    {consultType === "breast" && "💜"}
                    {consultType} Consultation Photos
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {typePhotos.map((photo) => (
                      <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                        {photo.url ? (
                          <img src={photo.url} alt={photo.position} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                          <p className="text-[10px] text-white truncate capitalize">{photo.position.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Intake Photos */}
        {photos.length > 0 && (
          <div>
            {consultationPhotos.length > 0 && <p className="text-xs font-medium text-slate-600 mb-2">Intake Photos</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                  {photoUrls[photo.id] ? (
                    <img src={photoUrls[photo.id]} alt={photo.file_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-xs text-white truncate">{photo.file_name}</p>
                    <p className="text-xs text-white/60">{new Date(photo.uploaded_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {photos.length === 0 && consultationPhotos.length === 0 && (
          <p className="text-sm text-slate-400 italic">No photos uploaded.</p>
        )}
      </div>
      </>
    );
  }
}
