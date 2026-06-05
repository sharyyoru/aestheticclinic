"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { Phone, PhoneOff, Search, Filter, RefreshCw, CheckCircle, XCircle, User, ChevronDown, Plus, Trash2, Bot, FileJson, Clock, AlertCircle, ChevronLeft, ChevronRight, Eye, Copy, Check } from "lucide-react";

type ProfileData = {
  id: string;
  email: string;
  full_name: string | null;
};

type RetellLog = {
  id: string;
  call_id: string | null;
  event_type: string | null;
  function_name: string | null;
  request_body: Record<string, unknown>;
  args: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  dynamic_variables: Record<string, unknown> | null;
  call_data: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  response_status: number | null;
  processing_time_ms: number | null;
  error_message: string | null;
  patient_id: string | null;
  created_at: string;
};

type DroppedCall = {
  id: string;
  retell_call_id: string | null;
  from_number: string;
  to_number: string | null;
  call_duration_seconds: number | null;
  disconnection_reason: string | null;
  transcript: string | null;
  patient_id: string | null;
  deal_id: string | null;
  task_id: string | null;
  assigned_to: string | null;
  assignment_method: string;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  // Joined data
  patient?: { first_name: string; last_name: string } | null;
  assigned_user?: { email: string; raw_user_meta_data?: { full_name?: string } } | null;
};

type RoundRobinUser = {
  id: string;
  user_id: string;
  is_active: boolean;
  last_assigned_at: string | null;
  assignment_count: number;
  user?: { email: string; raw_user_meta_data?: { full_name?: string } } | null;
};

type SystemUser = {
  id: string;
  email: string;
  raw_user_meta_data?: { full_name?: string | null };
};

export default function AgentsPage() {
  const supabase = supabaseClient;
  const [activeTab, setActiveTab] = useState<"dropped-calls" | "round-robin" | "retell-logs">("dropped-calls");
  
  // Dropped calls state
  const [droppedCalls, setDroppedCalls] = useState<DroppedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<DroppedCall | null>(null);
  
  // Round robin state
  const [roundRobinUsers, setRoundRobinUsers] = useState<RoundRobinUser[]>([]);
  const [allUsers, setAllUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Retell logs state
  const [retellLogs, setRetellLogs] = useState<RetellLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const [functionFilter, setFunctionFilter] = useState<string>("all");
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<RetellLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch dropped calls
  const fetchDroppedCalls = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("dropped_calls")
        .select(`
          *,
          patient:patients(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching dropped calls:", error);
        return;
      }

      // Fetch assigned user info separately (auth.users requires admin)
      const callsWithUsers = await Promise.all(
        (data || []).map(async (call: DroppedCall) => {
          if (call.assigned_to) {
            const { data: userData } = await supabase
              .from("profiles")
              .select("id, email, full_name")
              .eq("id", call.assigned_to)
              .single();
            
            return {
              ...call,
              assigned_user: userData ? { 
                email: userData.email, 
                raw_user_meta_data: { full_name: userData.full_name } 
              } : null,
            };
          }
          return call;
        })
      );

      setDroppedCalls(callsWithUsers);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, statusFilter]);

  // Fetch round robin users
  const fetchRoundRobinUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data: rrData, error: rrError } = await supabase
        .from("dropped_call_round_robin")
        .select("*")
        .order("assignment_count", { ascending: true });

      if (rrError) {
        console.error("Error fetching round robin:", rrError);
        return;
      }

      // Fetch user details from profiles
      const usersWithDetails = await Promise.all(
        (rrData || []).map(async (rr: RoundRobinUser) => {
          const { data: userData } = await supabase
            .from("profiles")
            .select("id, email, full_name")
            .eq("id", rr.user_id)
            .single();
          
          return {
            ...rr,
            user: userData ? { 
              email: userData.email, 
              raw_user_meta_data: { full_name: userData.full_name } 
            } : null,
          };
        })
      );

      setRoundRobinUsers(usersWithDetails);

      // Fetch all users for adding to round robin
      const { data: allUsersData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("email");

      setAllUsers(
        (allUsersData || []).map((u: ProfileData) => ({
          id: u.id,
          email: u.email,
          raw_user_meta_data: { full_name: u.full_name },
        }))
      );
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [supabase]);

  // Fetch Retell logs
  const fetchRetellLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: "50",
      });
      if (functionFilter !== "all") params.set("function", functionFilter);
      if (logSearchTerm) params.set("search", logSearchTerm);

      const response = await fetch(`/api/retell/logs?${params.toString()}`);
      const data = await response.json();

      if (data.error) {
        console.error("Error fetching logs:", data.error);
        return;
      }

      setRetellLogs(data.logs || []);
      setLogsTotalPages(data.pagination?.totalPages || 1);
      setLogsTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [logsPage, functionFilter, logSearchTerm]);

  useEffect(() => {
    fetchDroppedCalls();
  }, [fetchDroppedCalls]);

  useEffect(() => {
    if (activeTab === "round-robin") {
      fetchRoundRobinUsers();
    }
    if (activeTab === "retell-logs") {
      fetchRetellLogs();
    }
  }, [activeTab, fetchRoundRobinUsers, fetchRetellLogs]);

  // Filter dropped calls by search term
  const filteredCalls = droppedCalls.filter((call) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      call.from_number.toLowerCase().includes(search) ||
      call.patient?.first_name?.toLowerCase().includes(search) ||
      call.patient?.last_name?.toLowerCase().includes(search) ||
      call.disconnection_reason?.toLowerCase().includes(search)
    );
  });

  // Update call status
  const updateCallStatus = async (callId: string, status: string, notes?: string) => {
    const { error } = await supabase
      .from("dropped_calls")
      .update({
        status,
        resolution_notes: notes || null,
        resolved_at: ["resolved", "contacted", "no_answer", "invalid"].includes(status) 
          ? new Date().toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId);

    if (error) {
      console.error("Error updating status:", error);
      return;
    }

    fetchDroppedCalls();
    setSelectedCall(null);
  };

  // Add user to round robin
  const addUserToRoundRobin = async (userId: string) => {
    const { error } = await supabase
      .from("dropped_call_round_robin")
      .insert({
        user_id: userId,
        is_active: true,
        assignment_count: 0,
      });

    if (error) {
      if (error.code === "23505") {
        alert("User is already in the round-robin list");
      } else {
        console.error("Error adding user:", error);
      }
      return;
    }

    fetchRoundRobinUsers();
  };

  // Toggle user active status
  const toggleUserActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("dropped_call_round_robin")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      console.error("Error toggling user:", error);
      return;
    }

    fetchRoundRobinUsers();
  };

  // Remove user from round robin
  const removeUserFromRoundRobin = async (id: string) => {
    if (!confirm("Remove this user from the round-robin list?")) return;

    const { error } = await supabase
      .from("dropped_call_round_robin")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error removing user:", error);
      return;
    }

    fetchRoundRobinUsers();
  };

  // Format phone for display
  const formatPhone = (phone: string) => {
    if (!phone) return "Unknown";
    // Format Swiss numbers nicely
    if (phone.startsWith("+41")) {
      const digits = phone.slice(3);
      if (digits.length === 9) {
        return `+41 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
      }
    }
    return phone;
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-700";
      case "contacted": return "bg-blue-100 text-blue-700";
      case "resolved": return "bg-green-100 text-green-700";
      case "no_answer": return "bg-slate-100 text-slate-700";
      case "invalid": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Agents</h1>
            <p className="text-sm text-slate-500">Manage AI voice agents and dropped calls</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("dropped-calls")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "dropped-calls"
              ? "border-violet-500 text-violet-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <PhoneOff className="h-4 w-4 inline-block mr-2" />
          Dropped Calls
        </button>
        <button
          onClick={() => setActiveTab("round-robin")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "round-robin"
              ? "border-violet-500 text-violet-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <User className="h-4 w-4 inline-block mr-2" />
          Round Robin Users
        </button>
        <button
          onClick={() => setActiveTab("retell-logs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "retell-logs"
              ? "border-violet-500 text-violet-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileJson className="h-4 w-4 inline-block mr-2" />
          Retell Logs
        </button>
      </div>

      {/* Dropped Calls Tab */}
      {activeTab === "dropped-calls" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by phone, name, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="resolved">Resolved</option>
                <option value="no_answer">No Answer</option>
                <option value="invalid">Invalid</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={fetchDroppedCalls}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Dropped Calls Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Assigned To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading...
                      </td>
                    </tr>
                  ) : filteredCalls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        <PhoneOff className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        No dropped calls found
                      </td>
                    </tr>
                  ) : (
                    filteredCalls.map((call) => (
                      <tr key={call.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span className="font-mono text-sm">{formatPhone(call.from_number)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {call.patient ? (
                            <a
                              href={`/patients/${call.patient_id}`}
                              className="text-sm text-violet-600 hover:underline"
                            >
                              {call.patient.first_name} {call.patient.last_name}
                            </a>
                          ) : (
                            <span className="text-sm text-slate-400">Not in system</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600 line-clamp-1">
                            {call.disconnection_reason || "Unknown"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {call.assigned_user ? (
                              <span className="text-slate-700">
                                {call.assigned_user.raw_user_meta_data?.full_name || call.assigned_user.email}
                              </span>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                            {call.assignment_method === "deal_owner" && (
                              <span className="ml-1 text-xs text-violet-500">(Deal Owner)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                            {call.status.charAt(0).toUpperCase() + call.status.slice(1).replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-500">
                            {new Date(call.created_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setSelectedCall(call)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                              title="View details"
                            >
                              <Search className="h-4 w-4" />
                            </button>
                            {call.status === "pending" && (
                              <>
                                <button
                                  onClick={() => updateCallStatus(call.id, "contacted")}
                                  className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700"
                                  title="Mark as contacted"
                                >
                                  <Phone className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => updateCallStatus(call.id, "resolved")}
                                  className="p-1.5 rounded hover:bg-green-50 text-green-500 hover:text-green-700"
                                  title="Mark as resolved"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Round Robin Tab */}
      {activeTab === "round-robin" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Users in this list will receive dropped call follow-up tasks in round-robin order.
            </p>
            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addUserToRoundRobin(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="pl-10 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none appearance-none bg-white"
                defaultValue=""
              >
                <option value="" disabled>Add user to round robin...</option>
                {allUsers
                  .filter((u) => !roundRobinUsers.some((rr) => rr.user_id === u.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.raw_user_meta_data?.full_name || user.email}
                    </option>
                  ))}
              </select>
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Assignments</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Last Assigned</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : roundRobinUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                      <User className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      No users configured for round-robin
                    </td>
                  </tr>
                ) : (
                  roundRobinUsers.map((rr) => (
                    <tr key={rr.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-medium text-sm">
                            {(rr.user?.raw_user_meta_data?.full_name || rr.user?.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {rr.user?.raw_user_meta_data?.full_name || "Unknown"}
                            </div>
                            <div className="text-xs text-slate-500">{rr.user?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleUserActive(rr.id, rr.is_active)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            rr.is_active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {rr.is_active ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" />
                              Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{rr.assignment_count}</span>
                        <span className="text-sm text-slate-500"> calls</span>
                      </td>
                      <td className="px-4 py-3">
                        {rr.last_assigned_at ? (
                          <span className="text-sm text-slate-500">
                            {new Date(rr.last_assigned_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">Never</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeUserFromRoundRobin(rr.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700"
                          title="Remove from round robin"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Retell Logs Tab */}
      {activeTab === "retell-logs" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by call ID or function..."
                value={logSearchTerm}
                onChange={(e) => {
                  setLogSearchTerm(e.target.value);
                  setLogsPage(1);
                }}
                onKeyDown={(e) => e.key === "Enter" && fetchRetellLogs()}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={functionFilter}
                onChange={(e) => {
                  setFunctionFilter(e.target.value);
                  setLogsPage(1);
                }}
                className="pl-10 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none appearance-none bg-white"
              >
                <option value="all">All Functions</option>
                <option value="check_availability">check_availability</option>
                <option value="book_appointment">book_appointment</option>
                <option value="send_whatsapp">send_whatsapp</option>
                <option value="end_call">end_call</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={fetchRetellLogs}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className={`h-4 w-4 ${loadingLogs ? "animate-spin" : ""}`} />
            </button>
            <span className="text-sm text-slate-500">
              {logsTotal} total logs
            </span>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Function</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Call ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Dynamic Variables</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Args</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading...
                      </td>
                    </tr>
                  ) : retellLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <FileJson className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    retellLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {new Date(log.created_at).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.function_name === "book_appointment" ? "bg-green-100 text-green-700" :
                            log.function_name === "check_availability" ? "bg-blue-100 text-blue-700" :
                            log.function_name === "send_whatsapp" ? "bg-violet-100 text-violet-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {log.function_name || log.event_type || "unknown"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono text-slate-500 max-w-[120px] truncate">
                              {log.call_id || "-"}
                            </span>
                            {log.call_id && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(log.call_id || "");
                                  setCopiedId(log.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1 rounded hover:bg-slate-100"
                              >
                                {copiedId === log.id ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-slate-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const dynVars = (log.dynamic_variables || {}) as Record<string, unknown>;
                            const meta = (log.metadata || {}) as Record<string, unknown>;
                            const patientId = String(log.patient_id || dynVars.patient_id || meta.patient_id || "");
                            const patientName = String(dynVars.user_name || dynVars.first_name || meta.patient_name || "");
                            
                            if (patientId || patientName) {
                              return (
                                <div className="text-xs text-slate-600 max-w-[200px]">
                                  {patientName && (
                                    <div><span className="text-slate-400">name:</span> {patientName}</div>
                                  )}
                                  {patientId && (
                                    <a href={`/patients/${patientId}`} className="text-violet-600 hover:underline">
                                      <span className="text-slate-400">id:</span> {patientId.slice(0, 8)}...
                                    </a>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <span className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                No patient data
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {log.args ? (
                            <div className="text-xs text-slate-600 max-w-[150px] truncate">
                              {Object.entries(log.args).slice(0, 2).map(([k, v]) => (
                                <div key={k}><span className="text-slate-400">{k}:</span> {String(v).slice(0, 20)}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded hover:bg-violet-50 text-violet-500 hover:text-violet-700"
                            title="View full request"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logsTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  Page {logsPage} of {logsTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPage === 1}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))}
                    disabled={logsPage === logsTotalPages}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retell Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Request Details</h3>
                  <p className="text-sm text-slate-500">
                    {selectedLog.function_name || selectedLog.event_type} • {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Call ID</label>
                  <p className="text-sm font-mono text-slate-900 break-all">{selectedLog.call_id || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Function</label>
                  <p className="text-sm text-slate-900">{selectedLog.function_name || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Processing Time</label>
                  <p className="text-sm text-slate-900">{selectedLog.processing_time_ms || 0}ms</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Patient ID</label>
                  <p className="text-sm text-slate-900 break-all">
                    {selectedLog.patient_id ? (
                      <a href={`/patients/${selectedLog.patient_id}`} className="text-violet-600 hover:underline">
                        {selectedLog.patient_id.slice(0, 8)}...
                      </a>
                    ) : (
                      <span className="text-amber-600">None</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Dynamic Variables */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">
                  Dynamic Variables (retell_llm_dynamic_variables)
                </label>
                <pre className="text-xs bg-slate-50 rounded-lg p-4 overflow-x-auto border border-slate-200">
                  {selectedLog.dynamic_variables 
                    ? JSON.stringify(selectedLog.dynamic_variables, null, 2) 
                    : "null (Not passed by Retell)"}
                </pre>
              </div>

              {/* Metadata */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Metadata</label>
                <pre className="text-xs bg-slate-50 rounded-lg p-4 overflow-x-auto border border-slate-200">
                  {selectedLog.metadata 
                    ? JSON.stringify(selectedLog.metadata, null, 2) 
                    : "null"}
                </pre>
              </div>

              {/* Arguments */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Function Arguments</label>
                <pre className="text-xs bg-slate-50 rounded-lg p-4 overflow-x-auto border border-slate-200">
                  {selectedLog.args 
                    ? JSON.stringify(selectedLog.args, null, 2) 
                    : "null"}
                </pre>
              </div>

              {/* Call Data */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Call Data</label>
                <pre className="text-xs bg-slate-50 rounded-lg p-4 overflow-x-auto border border-slate-200 max-h-48">
                  {selectedLog.call_data 
                    ? JSON.stringify(selectedLog.call_data, null, 2) 
                    : "null"}
                </pre>
              </div>

              {/* Full Request Body */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Full Request Body</label>
                <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-4 overflow-x-auto max-h-64">
                  {JSON.stringify(selectedLog.request_body, null, 2)}
                </pre>
              </div>

              {/* Error */}
              {selectedLog.error_message && (
                <div>
                  <label className="text-xs font-medium text-red-500 uppercase mb-2 block">Error</label>
                  <pre className="text-xs bg-red-50 text-red-700 rounded-lg p-4 overflow-x-auto border border-red-200">
                    {selectedLog.error_message}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog.request_body, null, 2));
                }}
                className="flex-1 py-2 px-4 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
              >
                <Copy className="h-4 w-4 inline-block mr-2" />
                Copy Full Request
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="flex-1 py-2 px-4 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Dropped Call Details</h3>
                <button
                  onClick={() => setSelectedCall(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Phone Number</label>
                <p className="text-lg font-mono text-slate-900">{formatPhone(selectedCall.from_number)}</p>
              </div>
              
              {selectedCall.patient && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Patient</label>
                  <p className="text-slate-900">
                    <a href={`/patients/${selectedCall.patient_id}`} className="text-violet-600 hover:underline">
                      {selectedCall.patient.first_name} {selectedCall.patient.last_name}
                    </a>
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Reason</label>
                <p className="text-slate-700">{selectedCall.disconnection_reason || "Unknown"}</p>
              </div>

              {selectedCall.transcript && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Transcript</label>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {selectedCall.transcript}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
                  <p className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedCall.status)}`}>
                    {selectedCall.status.charAt(0).toUpperCase() + selectedCall.status.slice(1).replace("_", " ")}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">Assignment</label>
                  <p className="text-sm text-slate-700">
                    {selectedCall.assignment_method === "deal_owner" ? "Deal Owner" : "Round Robin"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Received</label>
                <p className="text-slate-700">
                  {new Date(selectedCall.created_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => updateCallStatus(selectedCall.id, "contacted")}
                className="flex-1 py-2 px-4 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
              >
                <Phone className="h-4 w-4 inline-block mr-2" />
                Mark Contacted
              </button>
              <button
                onClick={() => updateCallStatus(selectedCall.id, "resolved")}
                className="flex-1 py-2 px-4 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
              >
                <CheckCircle className="h-4 w-4 inline-block mr-2" />
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
