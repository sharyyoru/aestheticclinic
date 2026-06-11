"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Home,
  Calendar,
  FolderHeart,
  Camera,
  User,
  Clock,
  MapPin,
  Pill,
  Stethoscope,
  ClipboardList,
  LogOut,
  ChevronRight,
  ChevronDown,
  Loader2,
  ShieldCheck,
} from "lucide-react";

type TabId = "home" | "appointments" | "records" | "photos" | "profile";

type PatientInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Appointment = {
  id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  title: string;
  doctor: string | null;
  location: string | null;
};

type Prescription = {
  journal_entry_id: string;
  product_name: string | null;
  product_type: string | null;
  amount_morning: number | null;
  amount_noon: number | null;
  amount_evening: number | null;
  amount_night: number | null;
  intake_note: string | null;
  quantity: number | null;
  intake_from_date: string | null;
};

type Consultation = {
  id: string;
  title: string | null;
  content: string | null;
  record_type: string | null;
  doctor_name: string | null;
  scheduled_at: string | null;
};

type PhotoItem = {
  id: string;
  url: string;
  label: string;
  group: string;
  uploadedAt: string | null;
};

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "appointments", label: "Visits", icon: Calendar },
  { id: "records", label: "Records", icon: FolderHeart },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "profile", label: "Profile", icon: User },
];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("patientapp_token");
}

async function apiFetch(section: string) {
  const token = getToken();
  const res = await fetch(`/api/patientapp/data?section=${section}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    localStorage.removeItem("patientapp_token");
    localStorage.removeItem("patientapp_patient");
    window.location.href = "/patientapp/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function PatientAppPage() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section data
  const [overview, setOverview] = useState<any>(null);
  const [appointments, setAppointments] = useState<{ upcoming: Appointment[]; past: Appointment[] } | null>(null);
  const [records, setRecords] = useState<any>(null);
  const [photos, setPhotos] = useState<PhotoItem[] | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const [expandedConsultation, setExpandedConsultation] = useState<string | null>(null);
  const [apptView, setApptView] = useState<"upcoming" | "past">("upcoming");

  // Auth check on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/patientapp/login";
      return;
    }
    const stored = localStorage.getItem("patientapp_patient");
    if (stored) {
      try {
        setPatient(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Load data for active tab
  const loadTab = useCallback(async (tab: TabId) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "home") {
        const data = await apiFetch("overview");
        setOverview(data);
        if (data.patient) setPatient(data.patient);
      } else if (tab === "appointments") {
        setAppointments(await apiFetch("appointments"));
      } else if (tab === "records") {
        setRecords(await apiFetch("records"));
      } else if (tab === "photos") {
        const data = await apiFetch("photos");
        setPhotos(data.photos);
      } else if (tab === "profile") {
        setProfile(await apiFetch("profile"));
      }
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError("Could not load your data. Pull down or tap to retry.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  function handleLogout() {
    localStorage.removeItem("patientapp_token");
    localStorage.removeItem("patientapp_patient");
    window.location.href = "/patientapp/login";
  }

  const firstName = patient?.first_name || "there";

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50">
      {/* Safe area top */}
      <div className="bg-white" style={{ paddingTop: "env(safe-area-inset-top)" }} />

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <Image src="/logos/aliice-logo.png" alt="Aliice" width={90} height={30} className="h-7 w-auto" />
        {patient && (
          <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-semibold text-sm">
            {(patient.first_name?.[0] || "") + (patient.last_name?.[0] || "") || "P"}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          </div>
        ) : error ? (
          <button onClick={() => loadTab(activeTab)} className="w-full p-8 text-center text-slate-500 text-sm">
            {error}
          </button>
        ) : (
          <>
            {/* ─── HOME ─── */}
            {activeTab === "home" && overview && (
              <div className="p-5 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Hello, {firstName}</h1>
                  <p className="text-slate-500 text-sm mt-0.5">Welcome to your patient portal</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5 text-sky-500" />
                    </div>
                    <p className="text-xl font-bold text-slate-900">{overview.upcomingAppointments?.length || 0}</p>
                    <p className="text-xs text-slate-500">Upcoming Visits</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center mb-2">
                      <Pill className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-xl font-bold text-slate-900">{overview.stats?.prescriptions || 0}</p>
                    <p className="text-xs text-slate-500">Active Prescriptions</p>
                  </div>
                </div>

                {/* Next appointments */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-slate-900">Next Appointments</h2>
                    <button onClick={() => setActiveTab("appointments")} className="text-sky-600 text-sm font-medium">
                      View All
                    </button>
                  </div>
                  {overview.upcomingAppointments?.length ? (
                    <div className="space-y-3">
                      {overview.upcomingAppointments.map((appt: Appointment) => (
                        <AppointmentCard key={appt.id} appt={appt} />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-6 text-center border border-slate-100">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No upcoming appointments</p>
                    </div>
                  )}
                </section>

                {/* Quick links */}
                <section className="space-y-2">
                  <QuickLink icon={FolderHeart} label="My Medical Records" onClick={() => setActiveTab("records")} />
                  <QuickLink icon={Camera} label="My Photos" onClick={() => setActiveTab("photos")} />
                  <QuickLink icon={User} label="My Profile & Insurance" onClick={() => setActiveTab("profile")} />
                </section>
              </div>
            )}

            {/* ─── APPOINTMENTS ─── */}
            {activeTab === "appointments" && appointments && (
              <div className="p-5 space-y-4">
                <h1 className="text-xl font-bold text-slate-900">My Appointments</h1>
                <div className="flex bg-slate-100 rounded-xl p-1">
                  {(["upcoming", "past"] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => setApptView(view)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        apptView === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      {view === "upcoming" ? "Upcoming" : "Past"}
                    </button>
                  ))}
                </div>
                {appointments[apptView].length ? (
                  <div className="space-y-3">
                    {appointments[apptView].map((appt) => (
                      <AppointmentCard key={appt.id} appt={appt} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                    <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No {apptView} appointments</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── RECORDS ─── */}
            {activeTab === "records" && records && (
              <div className="p-5 space-y-6">
                <h1 className="text-xl font-bold text-slate-900">My Medical Records</h1>

                {/* Prescriptions */}
                <section>
                  <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-purple-500" /> Prescriptions
                  </h2>
                  {records.prescriptions?.length ? (
                    <div className="space-y-2">
                      {records.prescriptions.map((rx: Prescription) => (
                        <div key={rx.journal_entry_id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                          <p className="font-medium text-slate-900 text-sm">{rx.product_name || "Medication"}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            <span>☀️ {rx.amount_morning ?? 0}</span>
                            <span>🕛 {rx.amount_noon ?? 0}</span>
                            <span>🌆 {rx.amount_evening ?? 0}</span>
                            <span>🌙 {rx.amount_night ?? 0}</span>
                            {rx.quantity ? <span className="ml-auto">Qty: {rx.quantity}</span> : null}
                          </div>
                          {rx.intake_note && <p className="text-xs text-slate-500 mt-1.5 italic">{rx.intake_note}</p>}
                          {rx.intake_from_date && (
                            <p className="text-[11px] text-slate-400 mt-1">From {formatDate(rx.intake_from_date)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyCard text="No active prescriptions" />
                  )}
                </section>

                {/* Consultations */}
                <section>
                  <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-sky-500" /> Consultations
                  </h2>
                  {records.consultations?.length ? (
                    <div className="space-y-2">
                      {records.consultations.map((c: Consultation) => {
                        const expanded = expandedConsultation === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setExpandedConsultation(expanded ? null : c.id)}
                            className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-left"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 text-sm truncate">
                                  {c.title || "Consultation"}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {formatDate(c.scheduled_at)}
                                  {c.doctor_name ? ` • ${c.doctor_name}` : ""}
                                </p>
                              </div>
                              <ChevronDown
                                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                              />
                            </div>
                            {expanded && c.content && (
                              <div
                                className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 whitespace-pre-wrap break-words max-h-72 overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: c.content.replace(/<script[\s\S]*?<\/script>/gi, "") }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyCard text="No consultations yet" />
                  )}
                </section>

                {/* Intake data */}
                <section>
                  <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-emerald-500" /> My Intake Information
                  </h2>
                  {records.intake?.healthBackground || records.intake?.measurements ? (
                    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                      {records.intake.healthBackground && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <InfoRow label="Height" value={records.intake.healthBackground.height_cm ? `${records.intake.healthBackground.height_cm} cm` : null} />
                          <InfoRow label="Weight" value={records.intake.healthBackground.weight_kg ? `${records.intake.healthBackground.weight_kg} kg` : null} />
                          <InfoRow label="BMI" value={records.intake.healthBackground.bmi} />
                          <InfoRow label="Allergies" value={records.intake.healthBackground.allergies} />
                          <InfoRow label="Known illnesses" value={records.intake.healthBackground.known_illnesses} />
                          <InfoRow label="Previous surgeries" value={records.intake.healthBackground.previous_surgeries} />
                          <InfoRow label="Medications" value={records.intake.healthBackground.medications} />
                          <InfoRow label="GP" value={records.intake.healthBackground.general_practitioner} />
                        </div>
                      )}
                      {records.intake.treatmentAreas?.length > 0 && (
                        <div className="pt-3 border-t border-slate-100">
                          <p className="text-xs font-medium text-slate-500 mb-1.5">Treatment interests</p>
                          <div className="flex flex-wrap gap-1.5">
                            {records.intake.treatmentAreas.map((area: any, i: number) => (
                              <span key={i} className="px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full text-xs">
                                {area.area_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <EmptyCard text="No intake form on file yet" />
                  )}
                </section>
              </div>
            )}

            {/* ─── PHOTOS ─── */}
            {activeTab === "photos" && photos && (
              <div className="p-5 space-y-4">
                <h1 className="text-xl font-bold text-slate-900">My Photos</h1>
                {photos.length ? (
                  Object.entries(
                    photos.reduce<Record<string, PhotoItem[]>>((acc, p) => {
                      (acc[p.group] ||= []).push(p);
                      return acc;
                    }, {}),
                  ).map(([group, items]) => (
                    <section key={group}>
                      <h2 className="font-semibold text-slate-700 text-sm mb-2">{group}</h2>
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((photo) => (
                          <a
                            key={photo.id}
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[10px] px-1.5 py-0.5 capitalize truncate">
                              {photo.label}
                            </span>
                          </a>
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <EmptyCard text="No photos on file" />
                )}
              </div>
            )}

            {/* ─── PROFILE ─── */}
            {activeTab === "profile" && profile && (
              <div className="p-5 space-y-5">
                <h1 className="text-xl font-bold text-slate-900">My Profile</h1>

                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-lg">
                    {(profile.patient?.first_name?.[0] || "") + (profile.patient?.last_name?.[0] || "") || "P"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {profile.patient?.first_name} {profile.patient?.last_name}
                    </p>
                    <p className="text-sm text-slate-500 truncate">{profile.patient?.email}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    <InfoRow label="Phone" value={profile.patient?.phone} />
                    <InfoRow label="Date of birth" value={profile.patient?.dob ? formatDate(profile.patient.dob) : null} />
                    <InfoRow label="Gender" value={profile.patient?.gender} />
                    <InfoRow label="Nationality" value={profile.patient?.nationality} />
                    <InfoRow label="Address" value={profile.patient?.street_address} />
                    <InfoRow label="City" value={[profile.patient?.postal_code, profile.patient?.town].filter(Boolean).join(" ")} />
                    <InfoRow label="Preferred clinic" value={profile.patient?.clinic_preference} />
                    <InfoRow label="Language" value={profile.patient?.language_preference} />
                  </div>
                </div>

                {profile.insurance && (
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <h2 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" /> Insurance
                    </h2>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                      <InfoRow label="Provider" value={profile.insurance.provider_name} />
                      <InfoRow label="Card number" value={profile.insurance.card_number} />
                      <InfoRow label="Type" value={profile.insurance.insurance_type} />
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-400 text-center px-4">
                  To update your details, please contact the clinic.
                </p>

                <button
                  onClick={handleLogout}
                  className="w-full py-3.5 bg-red-50 text-red-600 rounded-2xl font-semibold flex items-center justify-center gap-2 border border-red-100"
                >
                  <LogOut className="w-5 h-5" />
                  Log Out
                </button>
              </div>
            )}
          </>
        )}
        <div className="h-4" />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="bg-white border-t border-slate-200 flex-shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                  isActive ? "text-sky-600" : "text-slate-400"
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                <span className={`text-xs ${isActive ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function AppointmentCard({ appt }: { appt: Appointment }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">{appt.title}</p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            {formatDate(appt.start_time)} • {formatTime(appt.start_time)}
            {appt.end_time ? ` - ${formatTime(appt.end_time)}` : ""}
          </div>
          {appt.doctor && <p className="text-xs text-slate-500 mt-0.5">Dr. {appt.doctor}</p>}
          {appt.location && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
              <MapPin className="w-3 h-3" /> {appt.location}
            </div>
          )}
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${
            appt.status === "cancelled"
              ? "bg-red-50 text-red-600"
              : appt.status === "completed"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-sky-50 text-sky-600"
          }`}
        >
          {appt.status}
        </span>
      </div>
    </div>
  );
}

function QuickLink({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
        <Icon className="w-5 h-5 text-slate-500" />
      </div>
      <span className="flex-1 text-left text-sm font-medium text-slate-800">{label}</span>
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-slate-800 break-words">{value}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 text-center border border-slate-100">
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
