"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type PatientDetails = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  marital_status: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
};

type EditingSection = "details" | "address" | "emergency" | null;

const COLLAPSE_KEY = "patientDetailsCard_collapsed";

export default function PatientDetailsCard({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  
  // Edit form states
  const [editData, setEditData] = useState<Partial<PatientDetails>>({});

  // Load collapse preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${COLLAPSE_KEY}_${patientId}`);
    if (stored === "true") {
      setCollapsed(true);
    }
  }, [patientId]);

  // Save collapse preference
  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(`${COLLAPSE_KEY}_${patientId}`, String(newState));
  };

  const loadPatient = useCallback(async () => {
    setLoading(true);
    // First try with emergency contact fields
    let { data, error } = await supabaseClient
      .from("patients")
      .select(
        "id, first_name, last_name, email, phone, gender, marital_status, street_address, postal_code, town, country, emergency_contact_name, emergency_contact_phone, emergency_contact_relation"
      )
      .eq("id", patientId)
      .single();

    // If error (likely because emergency contact columns don't exist), try without them
    if (error) {
      const fallback = await supabaseClient
        .from("patients")
        .select(
          "id, first_name, last_name, email, phone, gender, marital_status, street_address, postal_code, town, country"
        )
        .eq("id", patientId)
        .single();
      
      if (!fallback.error && fallback.data) {
        data = {
          ...fallback.data,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          emergency_contact_relation: null,
        } as typeof data;
        error = null;
      }
    }

    if (!error && data) {
      setPatient(data as PatientDetails);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  const startEditing = (section: EditingSection) => {
    if (!patient) return;
    setEditData({ ...patient });
    setEditingSection(section);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditData({});
  };

  const saveChanges = async () => {
    if (!patient || !editingSection) return;
    setSaving(true);

    const updatePayload: Record<string, unknown> = {};

    if (editingSection === "details") {
      updatePayload.email = editData.email || null;
      updatePayload.phone = editData.phone || null;
      updatePayload.marital_status = editData.marital_status || null;
      updatePayload.gender = editData.gender || null;
    } else if (editingSection === "address") {
      updatePayload.street_address = editData.street_address || null;
      updatePayload.postal_code = editData.postal_code || null;
      updatePayload.town = editData.town || null;
      updatePayload.country = editData.country || null;
    } else if (editingSection === "emergency") {
      updatePayload.emergency_contact_name = editData.emergency_contact_name || null;
      updatePayload.emergency_contact_phone = editData.emergency_contact_phone || null;
      updatePayload.emergency_contact_relation = editData.emergency_contact_relation || null;
    }

    const { error } = await supabaseClient
      .from("patients")
      .update(updatePayload)
      .eq("id", patient.id);

    if (error) {
      // If error saving emergency contact (columns may not exist), show alert
      if (editingSection === "emergency") {
        alert("Emergency contact fields not available. Please run the database migration first.");
      } else {
        console.error("Failed to save:", error);
      }
    } else {
      await loadPatient();
      setEditingSection(null);
      setEditData({});
    }
    setSaving(false);
  };

  const EditButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  );

  const formatValue = (value: string | null | undefined) => {
    return value || "N/A";
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-slate-200 rounded w-1/4"></div>
          <div className="h-20 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.08)] mb-4">
      {/* Header with collapse toggle */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-xl"
        onClick={toggleCollapse}
      >
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Patient Information
        </h3>
        <button 
          type="button"
          className="p-1 rounded hover:bg-slate-100 transition-colors"
          onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
        >
          <svg 
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Collapsible content */}
      {!collapsed && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            
            {/* Patient Details Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient Details</h4>
                {editingSection !== "details" && <EditButton onClick={() => startEditing("details")} />}
              </div>
              
              {editingSection === "details" ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Email</label>
                    <input
                      type="email"
                      value={editData.email || ""}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Mobile Number</label>
                    <input
                      type="tel"
                      value={editData.phone || ""}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Civil Status</label>
                    <select
                      value={editData.marital_status || ""}
                      onChange={(e) => setEditData({ ...editData, marital_status: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    >
                      <option value="">Select...</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                      <option value="separated">Separated</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Gender</label>
                    <select
                      value={editData.gender || ""}
                      onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveChanges}
                      disabled={saving}
                      className="px-3 py-1.5 bg-slate-900 text-white text-[10px] rounded-md hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1.5 text-slate-600 text-[10px] hover:bg-slate-100 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-500">Email:</span>{" "}
                    <span className="text-sky-600">{formatValue(patient.email)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Mobile Number:</span>{" "}
                    <span className="text-sky-600">{formatValue(patient.phone)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Civil Status:</span>{" "}
                    <span className="text-slate-900 capitalize">{formatValue(patient.marital_status)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Gender:</span>{" "}
                    <span className="text-slate-900 capitalize">{formatValue(patient.gender)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Patient Number:</span>{" "}
                    <span className="text-slate-400 font-mono text-[10px]">{patient.id}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Patient Address Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient Address</h4>
                {editingSection !== "address" && <EditButton onClick={() => startEditing("address")} />}
              </div>
              
              {editingSection === "address" ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Street</label>
                    <input
                      type="text"
                      value={editData.street_address || ""}
                      onChange={(e) => setEditData({ ...editData, street_address: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Zip Code</label>
                    <input
                      type="text"
                      value={editData.postal_code || ""}
                      onChange={(e) => setEditData({ ...editData, postal_code: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Town</label>
                    <input
                      type="text"
                      value={editData.town || ""}
                      onChange={(e) => setEditData({ ...editData, town: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Country</label>
                    <input
                      type="text"
                      value={editData.country || ""}
                      onChange={(e) => setEditData({ ...editData, country: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveChanges}
                      disabled={saving}
                      className="px-3 py-1.5 bg-slate-900 text-white text-[10px] rounded-md hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1.5 text-slate-600 text-[10px] hover:bg-slate-100 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-500">Street:</span>{" "}
                    <span className="text-slate-900">{formatValue(patient.street_address)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Zip Code:</span>{" "}
                    <span className="text-slate-900">{formatValue(patient.postal_code)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Town:</span>{" "}
                    <span className="text-slate-900">{formatValue(patient.town)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Country:</span>{" "}
                    <span className="text-slate-900">{formatValue(patient.country)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Emergency Contact Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient Emergency Contact</h4>
                {editingSection !== "emergency" && <EditButton onClick={() => startEditing("emergency")} />}
              </div>
              
              {editingSection === "emergency" ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Name</label>
                    <input
                      type="text"
                      value={editData.emergency_contact_name || ""}
                      onChange={(e) => setEditData({ ...editData, emergency_contact_name: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Mobile Number</label>
                    <input
                      type="tel"
                      value={editData.emergency_contact_phone || ""}
                      onChange={(e) => setEditData({ ...editData, emergency_contact_phone: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Relation to Patient</label>
                    <select
                      value={editData.emergency_contact_relation || ""}
                      onChange={(e) => setEditData({ ...editData, emergency_contact_relation: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-900"
                    >
                      <option value="">Select...</option>
                      <option value="spouse">Spouse</option>
                      <option value="parent">Parent</option>
                      <option value="child">Child</option>
                      <option value="sibling">Sibling</option>
                      <option value="friend">Friend</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveChanges}
                      disabled={saving}
                      className="px-3 py-1.5 bg-slate-900 text-white text-[10px] rounded-md hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1.5 text-slate-600 text-[10px] hover:bg-slate-100 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-500">Name:</span>{" "}
                    <span className="text-slate-900">{formatValue(patient.emergency_contact_name)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Mobile Number:</span>{" "}
                    <span className="text-slate-900">{formatValue(patient.emergency_contact_phone)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Relation to Patient:</span>{" "}
                    <span className="text-slate-900 capitalize">{formatValue(patient.emergency_contact_relation)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Before and After Section (placeholder for future) */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Before and After</h4>
              <div className="text-xs">
                <a 
                  href={`/patients/${patientId}/3d`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors text-xs font-medium"
                >
                  View reconstruction
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
