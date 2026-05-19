"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile: string | null;
  avatar_url: string | null;
};

type Message = {
  role: "agent" | "user";
  content: string;
  timestamp: number;
};

type Conversation = {
  id: string;
  retell_chat_id: string | null;
  retell_call_id: string | null;
  conversation_type: "chat" | "web_call" | "phone_call";
  language: string;
  status: "active" | "completed" | "ended";
  visitor_email: string | null;
  visitor_phone: string | null;
  visitor_name: string | null;
  patient_id: string | null;
  patient_match_type: string | null;
  patient: Patient | null;
  messages: Message[];
  extracted_data: Record<string, unknown>;
  summary: string | null;
  source_url: string | null;
  started_at: string;
  ended_at: string | null;
};

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  chat: { label: "Chat", color: "bg-sky-100 text-sky-700", icon: "💬" },
  web_call: { label: "Voice Call", color: "bg-emerald-100 text-emerald-700", icon: "🎙️" },
  phone_call: { label: "Phone Call", color: "bg-violet-100 text-violet-700", icon: "📞" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700" },
  completed: { label: "Completed", color: "bg-slate-100 text-slate-600" },
  ended: { label: "Ended", color: "bg-slate-100 text-slate-500" },
};

export default function ChatLogsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [linkedFilter, setLinkedFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  
  // Selected conversation for detail view
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: "25" });
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (linkedFilter) params.set("patient_linked", linkedFilter);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/chat-logs?${params}`);
      const data = await res.json();
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error("Failed to fetch chat logs:", e);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter, linkedFilter, search]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleCreatePatient = async (conversationId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/chat-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, action: "create_patient" }),
      });
      if (res.ok) {
        fetchConversations();
        setSelected(null);
      }
    } catch (e) {
      console.error("Failed to create patient:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === "number" ? timestamp : timestamp);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMessagePreview = (messages: Message[]) => {
    if (!messages || messages.length === 0) return "No messages";
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (lastUserMsg) return lastUserMsg.content.slice(0, 100) + (lastUserMsg.content.length > 100 ? "..." : "");
    return messages[0].content.slice(0, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chat Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            View and manage all Aliice conversations ({total} total)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-700">💬 Chat</span>
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">🎙️ Voice</span>
            <span className="px-2 py-1 rounded-full bg-violet-100 text-violet-700">📞 Phone</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 p-4">
        <input
          type="text"
          placeholder="Search by email or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <option value="">All Types</option>
          <option value="chat">Chat</option>
          <option value="web_call">Voice Call</option>
          <option value="phone_call">Phone Call</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="ended">Ended</option>
        </select>
        <select
          value={linkedFilter}
          onChange={(e) => { setLinkedFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <option value="">All Patients</option>
          <option value="true">Linked to Patient</option>
          <option value="false">Not Linked</option>
        </select>
        <button
          onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setLinkedFilter(""); setPage(1); }}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
        >
          Clear Filters
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-slate-500 mt-3">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500">No conversations found</p>
            </div>
          ) : (
            <>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selected?.id === conv.id ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Type Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${TYPE_LABELS[conv.conversation_type]?.color || "bg-slate-100"}`}>
                      {TYPE_LABELS[conv.conversation_type]?.icon || "💬"}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_LABELS[conv.conversation_type]?.color}`}>
                          {TYPE_LABELS[conv.conversation_type]?.label}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_LABELS[conv.status]?.color}`}>
                          {STATUS_LABELS[conv.status]?.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {conv.language === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
                        </span>
                      </div>
                      
                      <div className="mt-1.5">
                        {conv.patient ? (
                          <div className="flex items-center gap-2">
                            {conv.patient.avatar_url ? (
                              <img src={conv.patient.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                                {conv.patient.first_name?.[0]}{conv.patient.last_name?.[0]}
                              </span>
                            )}
                            <Link href={`/patients/${conv.patient.id}`} className="text-sm font-medium text-slate-800 hover:text-sky-600">
                              {conv.patient.first_name} {conv.patient.last_name}
                            </Link>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {conv.patient_match_type === "email" ? "📧" : conv.patient_match_type === "phone" ? "📱" : conv.patient_match_type === "created" ? "✨" : "🔗"} Linked
                            </span>
                          </div>
                        ) : conv.visitor_email || conv.visitor_phone ? (
                          <div className="text-sm">
                            <span className="text-slate-700 font-medium">{conv.visitor_name || "Unknown Visitor"}</span>
                            <span className="text-slate-500 ml-2 text-xs">
                              {conv.visitor_email || conv.visitor_phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Anonymous visitor</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                        {getMessagePreview(conv.messages)}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                        <span>{formatTime(conv.started_at)}</span>
                        <span>•</span>
                        <span>{conv.messages?.length || 0} messages</span>
                        {conv.source_url && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[150px]" title={conv.source_url}>
                              {new URL(conv.source_url).hostname}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-slate-500">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="bg-white rounded-xl border border-slate-200 sticky top-4">
              {/* Header */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${TYPE_LABELS[selected.conversation_type]?.color}`}>
                      {TYPE_LABELS[selected.conversation_type]?.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{TYPE_LABELS[selected.conversation_type]?.label}</p>
                      <p className="text-xs text-slate-400">{formatTime(selected.started_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Visitor Info */}
              <div className="p-4 border-b border-slate-100 space-y-2">
                <h4 className="text-xs font-semibold text-slate-600 uppercase">Visitor Info</h4>
                {selected.visitor_email && (
                  <p className="text-sm"><span className="text-slate-500">Email:</span> <span className="text-slate-800">{selected.visitor_email}</span></p>
                )}
                {selected.visitor_phone && (
                  <p className="text-sm"><span className="text-slate-500">Phone:</span> <span className="text-slate-800">{selected.visitor_phone}</span></p>
                )}
                {selected.visitor_name && (
                  <p className="text-sm"><span className="text-slate-500">Name:</span> <span className="text-slate-800">{selected.visitor_name}</span></p>
                )}
                {!selected.visitor_email && !selected.visitor_phone && !selected.visitor_name && (
                  <p className="text-sm text-slate-400 italic">No contact information provided</p>
                )}

                {/* Patient Link Status */}
                <div className="pt-2">
                  {selected.patient ? (
                    <Link
                      href={`/patients/${selected.patient.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      {selected.patient.avatar_url ? (
                        <img src={selected.patient.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                          {selected.patient.first_name?.[0]}{selected.patient.last_name?.[0]}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-medium text-emerald-800">
                          {selected.patient.first_name} {selected.patient.last_name}
                        </p>
                        <p className="text-[10px] text-emerald-600">
                          Linked via {selected.patient_match_type} • View Profile →
                        </p>
                      </div>
                    </Link>
                  ) : (selected.visitor_email || selected.visitor_phone) ? (
                    <button
                      onClick={() => handleCreatePatient(selected.id)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors text-sm font-medium text-sky-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <span className="animate-spin w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          Create Patient Record
                        </>
                      )}
                    </button>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2">
                      No contact info to create patient
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 max-h-[400px] overflow-y-auto">
                <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">Conversation ({selected.messages?.length || 0})</h4>
                <div className="space-y-3">
                  {selected.messages?.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                        msg.role === "user"
                          ? "bg-sky-500 text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-800 rounded-bl-sm"
                      }`}>
                        {msg.content}
                        <p className={`text-[9px] mt-1 ${msg.role === "user" ? "text-sky-200" : "text-slate-400"}`}>
                          {new Date(msg.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!selected.messages || selected.messages.length === 0) && (
                    <p className="text-sm text-slate-400 italic text-center py-4">No messages recorded</p>
                  )}
                </div>
              </div>

              {/* Extracted Data */}
              {selected.extracted_data && Object.keys(selected.extracted_data).length > 0 && (
                <div className="p-4 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Extracted Data</h4>
                  <div className="bg-slate-50 rounded-lg p-3 text-xs">
                    <pre className="whitespace-pre-wrap text-slate-700">
                      {JSON.stringify(selected.extracted_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center sticky top-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={48} height={48} className="rounded-full" />
              </div>
              <h3 className="font-semibold text-slate-800">Select a conversation</h3>
              <p className="text-sm text-slate-500 mt-1">Click on a conversation to view details and messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
