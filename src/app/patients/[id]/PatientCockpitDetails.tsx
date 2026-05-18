"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { Pencil, X, ChevronDown } from "lucide-react";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";

const COLLAPSE_KEY = "patientCockpitDetails_collapsed";

type PatientData = {
  id: string;
  email: string | null;
  phone: string | null;
  marital_status: string | null;
  gender: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
};

type ModalType = "details" | "address" | "emergency" | null;

export default function PatientCockpitDetails({
  patient,
}: {
  patient: PatientData;
}) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Load collapse preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${COLLAPSE_KEY}_${patient.id}`);
    if (stored === "true") {
      setCollapsed(true);
    }
  }, [patient.id]);

  // Save collapse preference
  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(`${COLLAPSE_KEY}_${patient.id}`, String(newState));
  };

  // Patient Details form state
  const [email, setEmail] = useState(patient.email ?? "");
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [maritalStatus, setMaritalStatus] = useState(patient.marital_status ?? "");
  const [gender, setGender] = useState(patient.gender ?? "");

  // Patient Address form state
  const [streetAddress, setStreetAddress] = useState(patient.street_address ?? "");
  const [postalCode, setPostalCode] = useState(patient.postal_code ?? "");
  const [town, setTown] = useState(patient.town ?? "");
  const [country, setCountry] = useState(patient.country ?? "");

  // Emergency Contact form state
  const [emergencyName, setEmergencyName] = useState(patient.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(patient.emergency_contact_phone ?? "");
  const [emergencyRelation, setEmergencyRelation] = useState(patient.emergency_contact_relation ?? "");

  function handleOpen(type: ModalType) {
    // Reset form state to current patient values
    if (type === "details") {
      setEmail(patient.email ?? "");
      setPhone(patient.phone ?? "");
      setMaritalStatus(patient.marital_status ?? "");
      setGender(patient.gender ?? "");
    } else if (type === "address") {
      setStreetAddress(patient.street_address ?? "");
      setPostalCode(patient.postal_code ?? "");
      setTown(patient.town ?? "");
      setCountry(patient.country ?? "");
    } else if (type === "emergency") {
      setEmergencyName(patient.emergency_contact_name ?? "");
      setEmergencyPhone(patient.emergency_contact_phone ?? "");
      setEmergencyRelation(patient.emergency_contact_relation ?? "");
    }
    setOpenModal(type);
  }

  function handleAddressSelect(components: {
    street: string;
    postalCode: string;
    town: string;
    country: string;
  }) {
    if (components.postalCode) setPostalCode(components.postalCode);
    if (components.town) setTown(components.town);
    if (components.country) setCountry(components.country);
  }

  async function handleSave() {
    setSaving(true);
    let updateData: Record<string, string | null> = {};

    if (openModal === "details") {
      updateData = {
        email: email.trim() || null,
        phone: phone.trim() || null,
        marital_status: maritalStatus.trim() || null,
        gender: gender.trim() || null,
      };
    } else if (openModal === "address") {
      updateData = {
        street_address: streetAddress.trim() || null,
        postal_code: postalCode.trim() || null,
        town: town.trim() || null,
        country: country.trim() || null,
      };
    } else if (openModal === "emergency") {
      updateData = {
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        emergency_contact_relation: emergencyRelation.trim() || null,
      };
    }

    const { error } = await supabaseClient
      .from("patients")
      .update(updateData)
      .eq("id", patient.id);

    setSaving(false);

    if (!error) {
      setOpenModal(null);
      router.refresh();
    }
  }

  const editBtn = (type: ModalType) => (
    <button
      type="button"
      onClick={() => handleOpen(type)}
      className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
      aria-label="Edit"
    >
      <Pencil className="h-2.5 w-2.5" />
    </button>
  );

  return (
    <>
      <div className="rounded-xl border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        {/* Collapsible Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
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
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
          </button>
        </div>

        {/* Collapsible Content */}
        {!collapsed && (
        <div className="px-4 pb-4 border-t border-slate-100">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 pt-4">
          <div className="space-y-1 text-[11px]">
            <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Patient Details
              {editBtn("details")}
            </h3>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Email:</span>{" "}
              <span className="text-slate-900">{patient.email ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Mobile Number:</span>{" "}
              <span className="text-slate-900">{patient.phone ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Civil Status:</span>{" "}
              <span className="text-slate-900">{patient.marital_status ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Gender:</span>{" "}
              <span className="text-slate-900">{patient.gender ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Patient Number:</span>{" "}
              <span className="text-slate-900">{patient.id}</span>
            </p>
          </div>

          <div className="space-y-1 text-[11px]">
            <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Patient Address
              {editBtn("address")}
            </h3>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Street:</span>{" "}
              <span className="text-slate-900">{patient.street_address ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Zip Code:</span>{" "}
              <span className="text-slate-900">{patient.postal_code ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Town:</span>{" "}
              <span className="text-slate-900">{patient.town ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Country:</span>{" "}
              <span className="text-slate-900">{
                ({ CH:"🇨🇭 Switzerland", DE:"🇩🇪 Germany", FR:"🇫🇷 France", AT:"🇦🇹 Austria", IT:"🇮🇹 Italy", LI:"🇱🇮 Liechtenstein", LU:"🇱🇺 Luxembourg", BE:"🇧🇪 Belgium", NL:"🇳🇱 Netherlands", ES:"🇪🇸 Spain", PT:"🇵🇹 Portugal", GB:"🇬🇧 United Kingdom", US:"🇺🇸 United States", AE:"🇦🇪 United Arab Emirates" } as Record<string,string>)[patient.country ?? ""] || patient.country || "N/A"
              }</span>
            </p>
          </div>

          <div className="space-y-1 text-[11px]">
            <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Patient Emergency Contact
              {editBtn("emergency")}
            </h3>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Name:</span>{" "}
              <span className="text-slate-900">{patient.emergency_contact_name ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Mobile Number:</span>{" "}
              <span className="text-slate-900">{patient.emergency_contact_phone ?? "N/A"}</span>
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Relation to Patient:</span>{" "}
              <span className="text-slate-900">{patient.emergency_contact_relation ?? "N/A"}</span>
            </p>
          </div>

          <div className="space-y-2 text-[11px]">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Before and After
            </h3>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-500">
                  View reconstruction
                </p>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>

      {/* Modal overlay */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpenModal(null)}
              className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              {openModal === "details" && "Edit Patient Details"}
              {openModal === "address" && "Edit Patient Address"}
              {openModal === "emergency" && "Edit Emergency Contact"}
            </h2>

            <div className="space-y-3">
              {openModal === "details" && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Mobile Number</span>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Civil Status</span>
                    <input
                      type="text"
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Gender</span>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </>
              )}

              {openModal === "address" && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Street</span>
                    <AddressAutocompleteInput
                      value={streetAddress}
                      onChange={setStreetAddress}
                      onAddressSelect={handleAddressSelect}
                      placeholder="Start typing street address..."
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      countryBias="ch"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Zip Code</span>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Town</span>
                    <input
                      type="text"
                      value={town}
                      onChange={(e) => setTown(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Country</span>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    >
                      <option value="">Select country</option>
                      <option value="CH">🇨🇭 Switzerland (CH)</option>
                      <option value="DE">🇩🇪 Germany (DE)</option>
                      <option value="FR">🇫🇷 France (FR)</option>
                      <option value="AT">🇦🇹 Austria (AT)</option>
                      <option value="IT">🇮🇹 Italy (IT)</option>
                      <option value="LI">🇱🇮 Liechtenstein (LI)</option>
                      <option value="LU">🇱🇺 Luxembourg (LU)</option>
                      <option value="BE">🇧🇪 Belgium (BE)</option>
                      <option value="NL">🇳🇱 Netherlands (NL)</option>
                      <option value="ES">🇪🇸 Spain (ES)</option>
                      <option value="PT">🇵🇹 Portugal (PT)</option>
                      <option value="GB">🇬🇧 United Kingdom (GB)</option>
                      <option value="US">🇺🇸 United States (US)</option>
                      <option value="AE">🇦🇪 United Arab Emirates (AE)</option>
                    </select>
                  </label>
                </>
              )}

              {openModal === "emergency" && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Name</span>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      placeholder="Emergency contact name"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Mobile Number</span>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      placeholder="+41 XX XXX XX XX"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Relation to Patient</span>
                    <select
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    >
                      <option value="">Select relation</option>
                      <option value="spouse">Spouse</option>
                      <option value="parent">Parent</option>
                      <option value="child">Child</option>
                      <option value="sibling">Sibling</option>
                      <option value="friend">Friend</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
