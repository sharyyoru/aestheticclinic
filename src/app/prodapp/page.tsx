"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";
import { useProdApp } from "@/components/ProdAppContext";
import {
  Home,
  Users,
  Calendar,
  BarChart3,
  MessageCircle,
  Settings,
  Bell,
  Search,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  FileText,
  Activity,
  TrendingUp,
  UserPlus,
  CalendarPlus,
  Loader2,
  Menu,
  X,
  LogOut,
} from "lucide-react";

type TabId = "home" | "patients" | "agenda" | "deals" | "chat";

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type Appointment = {
  id: string;
  start_time: string;
  status: string;
  title: string | null;
  reason: string | null;
  notes: string | null;
  patient: { id: string; first_name: string | null; last_name: string | null } | null;
};

type Task = {
  id: string;
  name: string;
  content: string | null;
  activity_date: string | null;
  patient: { id: string; first_name: string | null; last_name: string | null } | null;
};

type Deal = {
  id: string;
  name: string;
  value: number | null;
  stage: string | null;
  patient: { id: string; first_name: string | null; last_name: string | null } | null;
};

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "patients", label: "Patients", icon: Users },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "deals", label: "Deals", icon: BarChart3 },
  { id: "chat", label: "Chat", icon: MessageCircle },
];

export default function ProdAppPage() {
  const router = useRouter();
  const { setAppMode } = useProdApp();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Set app mode on mount
  useEffect(() => {
    setAppMode(true);
  }, [setAppMode]);
  
  // Data states
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [stats, setStats] = useState({ todayAppointments: 0, pendingTasks: 0, newPatients: 0, openDeals: 0 });

  // Search ref for focus management
  const searchRef = useRef<HTMLInputElement>(null);

  // Check auth on mount
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // Redirect to login but stay in app
        window.location.href = "/login?redirect=/prodapp";
      } else {
        setUser(data.session.user);
        setLoading(false);
      }
    });
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      if (activeTab === "home") {
        // Load dashboard data
        const [apptRes, taskRes, statsRes] = await Promise.all([
          supabaseClient
            .from("appointments")
            .select("id, start_time, status, title, reason, notes, patient:patients(id, first_name, last_name)")
            .gte("start_time", dayStart)
            .lte("start_time", dayEnd)
            .neq("status", "cancelled")
            .order("start_time")
            .limit(5),
          supabaseClient
            .from("tasks")
            .select("id, name, content, activity_date, patient:patients(id, first_name, last_name)")
            .eq("assigned_user_id", user.id)
            .neq("status", "completed")
            .lte("activity_date", dayEnd)
            .order("activity_date")
            .limit(5),
          Promise.all([
            supabaseClient.from("appointments").select("id", { count: "exact", head: true }).gte("start_time", dayStart).lte("start_time", dayEnd).neq("status", "cancelled"),
            supabaseClient.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_user_id", user.id).neq("status", "completed"),
            supabaseClient.from("patients").select("id", { count: "exact", head: true }).gte("created_at", new Date(today.getFullYear(), today.getMonth(), 1).toISOString()),
            supabaseClient.from("deals").select("id", { count: "exact", head: true }).not("stage", "in", "(Won,Lost)"),
          ]),
        ]);
        
        setAppointments((apptRes.data || []) as unknown as Appointment[]);
        setTasks((taskRes.data || []) as unknown as Task[]);
        setStats({
          todayAppointments: statsRes[0].count || 0,
          pendingTasks: statsRes[1].count || 0,
          newPatients: statsRes[2].count || 0,
          openDeals: statsRes[3].count || 0,
        });
      } else if (activeTab === "patients") {
        const query = supabaseClient
          .from("patients")
          .select("id, first_name, last_name, email, phone, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        
        if (patientSearch) {
          query.or(`first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,email.ilike.%${patientSearch}%,phone.ilike.%${patientSearch}%`);
        }
        
        const { data } = await query;
        setPatients((data || []) as Patient[]);
      } else if (activeTab === "agenda") {
        const { data } = await supabaseClient
          .from("appointments")
          .select("id, start_time, status, title, reason, notes, patient:patients(id, first_name, last_name)")
          .gte("start_time", dayStart)
          .order("start_time")
          .limit(20);
        setAppointments((data || []) as unknown as Appointment[]);
      } else if (activeTab === "deals") {
        const { data } = await supabaseClient
          .from("deals")
          .select("id, name, value, stage, patient:patients(id, first_name, last_name)")
          .not("stage", "in", "(Won,Lost)")
          .order("created_at", { ascending: false })
          .limit(20);
        setDeals((data || []) as unknown as Deal[]);
      }
    };

    loadData();
  }, [user, activeTab, patientSearch]);

  // Internal navigation - prevents external browser
  const navigateInternal = useCallback((path: string) => {
    // Use window.location for full page navigation within the app
    // This keeps the navigation within WKWebView
    window.location.href = path;
  }, []);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "/login?redirect=/prodapp";
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-emerald-100 text-emerald-700";
      case "completed": return "bg-slate-100 text-slate-600";
      case "cancelled": return "bg-red-100 text-red-700";
      default: return "bg-sky-100 text-sky-700";
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-sky-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading Aliice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 overflow-hidden">
      {/* iOS Safe Area - Top */}
      <div className="bg-white safe-area-top" style={{ paddingTop: "env(safe-area-inset-top)" }} />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Image src="/logos/aliice-logo.png" alt="Aliice" width={80} height={26} className="h-7 w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateInternal("/patients/new")}
            className="p-2 rounded-full bg-sky-500 text-white active:bg-sky-600"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 rounded-full bg-slate-100 text-slate-600 active:bg-slate-200"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {/* Home Tab */}
        {activeTab === "home" && (
          <div className="p-4 space-y-6">
            {/* Welcome */}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Hello{user?.user_metadata?.first_name ? `, ${user.user_metadata.first_name}` : ""}
              </h1>
              <p className="text-slate-500 text-sm">Here&apos;s your day at a glance</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 rounded-xl">
                    <Calendar className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.todayAppointments}</p>
                    <p className="text-xs text-slate-500">Today&apos;s Appts</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.pendingTasks}</p>
                    <p className="text-xs text-slate-500">Pending Tasks</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.newPatients}</p>
                    <p className="text-xs text-slate-500">New This Month</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.openDeals}</p>
                    <p className="text-xs text-slate-500">Open Deals</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Appointments */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Appointments</h2>
                <button onClick={() => setActiveTab("agenda")} className="text-sky-600 text-sm font-medium">
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {appointments.length === 0 ? (
                  <div className="bg-white rounded-xl p-4 text-center text-slate-400 border border-slate-100">
                    No appointments today
                  </div>
                ) : (
                  appointments.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => apt.patient && navigateInternal(`/patients/${apt.patient.id}`)}
                      className="w-full bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 active:bg-slate-50 text-left"
                    >
                      <div className="flex-shrink-0">
                        <div className="text-lg font-semibold text-slate-900">{formatTime(apt.start_time)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {apt.patient ? `${apt.patient.first_name || ""} ${apt.patient.last_name || ""}`.trim() : "No patient"}
                        </p>
                        <p className="text-sm text-slate-500 truncate">{apt.title || apt.reason || "Appointment"}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                        {apt.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* Tasks */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Your Tasks</h2>
                <button onClick={() => navigateInternal("/tasks")} className="text-sky-600 text-sm font-medium">
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <div className="bg-white rounded-xl p-4 text-center text-slate-400 border border-slate-100">
                    No pending tasks
                  </div>
                ) : (
                  tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => task.patient && navigateInternal(`/patients/${task.patient.id}`)}
                      className="w-full bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 active:bg-slate-50 text-left"
                    >
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{task.name}</p>
                        {task.patient && (
                          <p className="text-sm text-slate-500 truncate">
                            {task.patient.first_name} {task.patient.last_name}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* Patients Tab */}
        {activeTab === "patients" && (
          <div className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search patients..."
                className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* Patient List */}
            <div className="space-y-2">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => navigateInternal(`/patients/${patient.id}`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 active:bg-slate-50 text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                    {(patient.first_name?.[0] || "").toUpperCase()}{(patient.last_name?.[0] || "").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      {patient.phone && (
                        <span className="flex items-center gap-1 truncate">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Agenda Tab */}
        {activeTab === "agenda" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </h2>
              <button
                onClick={() => navigateInternal("/appointments")}
                className="text-sky-600 text-sm font-medium"
              >
                Full Calendar
              </button>
            </div>

            <div className="space-y-2">
              {appointments.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No appointments scheduled</p>
                </div>
              ) : (
                appointments.map((apt) => (
                  <button
                    key={apt.id}
                    onClick={() => apt.patient && navigateInternal(`/patients/${apt.patient.id}`)}
                    className="w-full bg-white rounded-xl p-4 shadow-sm border border-slate-100 active:bg-slate-50 text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold text-slate-900">{formatTime(apt.start_time)}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                        {apt.status}
                      </span>
                    </div>
                    <p className="font-medium text-slate-800">
                      {apt.patient ? `${apt.patient.first_name || ""} ${apt.patient.last_name || ""}`.trim() : "No patient"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">{apt.title || apt.reason || "Appointment"}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Deals Tab */}
        {activeTab === "deals" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Open Deals</h2>
              <button
                onClick={() => navigateInternal("/deals")}
                className="text-sky-600 text-sm font-medium"
              >
                Pipeline View
              </button>
            </div>

            <div className="space-y-2">
              {deals.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No open deals</p>
                </div>
              ) : (
                deals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => deal.patient && navigateInternal(`/patients/${deal.patient.id}`)}
                    className="w-full bg-white rounded-xl p-4 shadow-sm border border-slate-100 active:bg-slate-50 text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-slate-900 truncate">{deal.name}</p>
                      {deal.value && (
                        <span className="text-emerald-600 font-semibold">
                          CHF {deal.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {deal.patient && (
                      <p className="text-sm text-slate-500">
                        {deal.patient.first_name} {deal.patient.last_name}
                      </p>
                    )}
                    <div className="mt-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {deal.stage || "New"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Chat with Aliice</h2>
              <p className="text-slate-500 mb-6">Your AI assistant for clinic management</p>
              <button
                onClick={() => navigateInternal("/chat")}
                className="px-6 py-3 bg-sky-500 text-white font-semibold rounded-xl active:bg-sky-600"
              >
                Open Chat
              </button>
            </div>
          </div>
        )}
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
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
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

      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Menu</h3>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {[
                { label: "Dashboard", href: "/", icon: Home },
                { label: "Patients", href: "/patients", icon: Users },
                { label: "Appointments", href: "/appointments", icon: Calendar },
                { label: "Deals & Pipeline", href: "/deals", icon: BarChart3 },
                { label: "Invoices", href: "/invoices", icon: FileText },
                { label: "Tasks", href: "/tasks", icon: CheckCircle2 },
                { label: "Statistics", href: "/statistics", icon: Activity },
                { label: "Settings", href: "/settings", icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      setMenuOpen(false);
                      navigateInternal(item.href);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-left"
                  >
                    <Icon className="w-5 h-5 text-slate-500" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 active:bg-red-100"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
