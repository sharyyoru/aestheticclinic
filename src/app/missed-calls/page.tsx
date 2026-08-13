"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { PhoneOff, RefreshCw, Search, Filter } from "lucide-react";
import {
  CONTACT_STATUS_OPTIONS,
  describeMissedCallReason,
  isMissedCallLog,
  type ContactStatus,
  type MissedCall,
} from "@/lib/missedCalls";

type CallLogRow = {
  id: string;
  from_number: string | null;
  direction: string | null;
  disconnection_reason: string | null;
  patient_id: string | null;
  assigned_user_name: string | null;
  task_id: string | null;
  contact_status: ContactStatus | null;
  created_at: string;
  started_at: string | null;
  patient: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

type DroppedCallRow = {
  id: string;
  from_number: string;
  disconnection_reason: string | null;
  patient_id: string | null;
  assigned_to: string | null;
  task_id: string | null;
  status: ContactStatus;
  created_at: string;
  patient: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

const STATUS_COLORS: Record<ContactStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  no_answer: "bg-slate-100 text-slate-700",
  invalid: "bg-red-100 text-red-700",
};

function formatPhone(phone: string | null): string {
  if (!phone) return "Unknown";
  if (phone.startsWith("+41")) {
    const digits = phone.slice(3);
    if (digits.length === 9) {
      return `+41 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
    }
  }
  return phone;
}

export default function MissedCallsPage() {
  const [calls, setCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ContactStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [callLogsResult, droppedCallsResult] = await Promise.all([
        supabaseClient
          .from("call_logs")
          .select(
            "id, from_number, direction, disconnection_reason, patient_id, assigned_user_name, task_id, contact_status, created_at, started_at, patient:patients(first_name, last_name, email)",
          )
          .not("disconnection_reason", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseClient
          .from("dropped_calls")
          .select(
            "id, from_number, disconnection_reason, patient_id, assigned_to, task_id, status, created_at, patient:patients(first_name, last_name, email)",
          )
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const callLogRows = (callLogsResult.data ?? []) as unknown as CallLogRow[];
      const droppedRows = (droppedCallsResult.data ?? []) as unknown as DroppedCallRow[];

      // Resolve assigned_to profile names for dropped_calls (call_logs already
      // stores a denormalized assigned_user_name column).
      const assignedIds = [...new Set(droppedRows.map((r) => r.assigned_to).filter((id): id is string => Boolean(id)))];
      let profileNameById = new Map<string, string>();
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assignedIds);
        profileNameById = new Map(
          (profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [
            p.id,
            p.full_name || p.email || "Unknown",
          ]),
        );
      }

      const fromCallLogs: MissedCall[] = callLogRows
        .filter((row) => isMissedCallLog(row))
        .map((row) => ({
          id: row.id,
          source: "call_log",
          phone: row.from_number,
          patientId: row.patient_id,
          patientName: row.patient
            ? [row.patient.first_name, row.patient.last_name].filter(Boolean).join(" ") || null
            : null,
          email: row.patient?.email ?? null,
          reason: row.disconnection_reason,
          assignedToName: row.assigned_user_name,
          status: (row.contact_status ?? "pending") as ContactStatus,
          createdAt: row.started_at || row.created_at,
          taskId: row.task_id,
        }));

      const fromDroppedCalls: MissedCall[] = droppedRows.map((row) => ({
        id: row.id,
        source: "dropped_call",
        phone: row.from_number,
        patientId: row.patient_id,
        patientName: row.patient
          ? [row.patient.first_name, row.patient.last_name].filter(Boolean).join(" ") || null
          : null,
        email: row.patient?.email ?? null,
        reason: row.disconnection_reason || "AI could not understand caller",
        assignedToName: row.assigned_to ? profileNameById.get(row.assigned_to) ?? "Unknown" : null,
        status: row.status,
        createdAt: row.created_at,
        taskId: row.task_id,
      }));

      const merged = [...fromCallLogs, ...fromDroppedCalls].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setCalls(merged);
    } catch (err) {
      console.error("[MissedCalls] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (call: MissedCall, status: ContactStatus) => {
    setUpdatingId(call.id);
    try {
      const nowIso = new Date().toISOString();
      if (call.source === "dropped_call") {
        await supabaseClient
          .from("dropped_calls")
          .update({
            status,
            resolved_at: status !== "pending" ? nowIso : null,
            updated_at: nowIso,
          })
          .eq("id", call.id);
      } else {
        await supabaseClient
          .from("call_logs")
          .update({
            contact_status: status,
            contact_resolved_at: status !== "pending" ? nowIso : null,
          })
          .eq("id", call.id);
      }
      setCalls((prev) => prev.map((c) => (c.id === call.id && c.source === call.source ? { ...c, status } : c)));
    } catch (err) {
      console.error("[MissedCalls] Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredCalls = useMemo(() => {
    let filtered = calls;
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          (c.phone || "").toLowerCase().includes(q) ||
          (c.patientName || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.reason || "").toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [calls, statusFilter, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <PhoneOff className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Missed Calls</h1>
          <p className="text-sm text-slate-500">
            Calls that never connected or the AI couldn&apos;t understand — follow up and mark contacted.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by phone, name, email, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | ContactStatus)}
            className="pl-10 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none appearance-none bg-white"
          >
            <option value="all">All Status</option>
            {CONTACT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void load()}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Date</th>
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
                    No missed calls found
                  </td>
                </tr>
              ) : (
                filteredCalls.map((call) => (
                  <tr key={`${call.source}-${call.id}`} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PhoneOff className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-sm">{formatPhone(call.phone)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {call.patientId ? (
                        <Link href={`/patients/${call.patientId}`} className="text-sm text-violet-600 hover:underline">
                          {call.patientName || "Unnamed patient"}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">Not in system</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{call.email || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600 line-clamp-1" title={call.reason ?? undefined}>
                        {call.source === "dropped_call" ? call.reason : describeMissedCallReason(call.reason)}
                      </span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-400">
                        {call.source === "dropped_call" ? "AI confused" : "Not connected"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{call.assignedToName || "Unassigned"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={call.status}
                        disabled={updatingId === call.id}
                        onChange={(e) => void updateStatus(call, e.target.value as ContactStatus)}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-violet-400 ${STATUS_COLORS[call.status]}`}
                      >
                        {CONTACT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500">
                        {new Date(call.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
