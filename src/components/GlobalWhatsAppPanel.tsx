"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, Search, Send, Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import ImagePreviewPortal from "@/components/ImagePreviewPortal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationPatient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface Conversation {
  id: string;
  patient_id: string;
  phone_number: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  window_open: boolean;
  window_expires_at: string | null;
  patient: ConversationPatient | null;
}

interface Message {
  id: string;
  body: string;
  fromMe: boolean;
  direction: string;
  status: string;
  timestamp: string | null;
  sent_at: string | null;
  created_at: string;
  media_url: string | null;
  template_id: string | null;
  message_sid: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  is_demo: boolean;
  scheduled_at: string | null;
}

interface GlobalWhatsAppPanelProps {
  open: boolean;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

const WA_ICON = (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatChatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function windowLabel(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "closed";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function statusTick(status: string) {
  if (status === "sent") return <span title="Sent" className="text-slate-400">✓</span>;
  if (status === "delivered") return <span title="Delivered" className="text-slate-400">✓✓</span>;
  if (status === "read") return <span title="Read" className="text-green-600">✓✓</span>;
  if (status === "failed") return <span title="Failed" className="text-red-500">✕</span>;
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalWhatsAppPanel({ open, onClose, onStatusChange }: GlobalWhatsAppPanelProps) {
  const [conversations, setConversations]         = useState<Conversation[]>([]);
  const [filteredConvs, setFilteredConvs]         = useState<Conversation[]>([]);
  const [convSearch, setConvSearch]               = useState("");
  const [selectedConv, setSelectedConv]           = useState<Conversation | null>(null);
  const [messages, setMessages]                   = useState<Message[]>([]);
  const [windowOpen, setWindowOpen]               = useState(false);
  const [windowExpiresAt, setWindowExpiresAt]     = useState<string | null>(null);
  const [messageInput, setMessageInput]           = useState("");
  const [loadingConvs, setLoadingConvs]           = useState(false);
  const [loadingMessages, setLoadingMessages]     = useState(false);
  const [sending, setSending]                     = useState(false);
  const [error, setError]                         = useState<string | null>(null);
  const [previewImage, setPreviewImage]           = useState<string | null>(null);
  const [activeTab, setActiveTab]                 = useState<"chats" | "sent">("chats");

  // Sent messages tab state
  const [loadingSent, setLoadingSent]             = useState(false);

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const pollIntervalRef  = useRef<NodeJS.Timeout | null>(null);
  const msgPollRef       = useRef<NodeJS.Timeout | null>(null);
  const isSendingRef     = useRef(false);

  useEffect(() => { isSendingRef.current = sending; }, [sending]);
  useEffect(() => { onStatusChange?.("ready"); }, [onStatusChange]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json() as { conversations: Conversation[] };
      setConversations(data.conversations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  // ── Load sent messages tab ──────────────────────────────────────────────────
  const loadSentMessages = useCallback(async () => {
    setLoadingSent(true);
    // Conversations list is already loaded; sent messages are surfaced per-conversation
    setLoadingSent(false);
  }, []);

  // ── Open / close lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    void loadConversations();
    // Poll conversations every 15s
    pollIntervalRef.current = setInterval(() => { void loadConversations(); }, 15000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (msgPollRef.current) clearInterval(msgPollRef.current);
    };
  }, [open, loadConversations]);

  // ── Filter conversations by search ─────────────────────────────────────────
  useEffect(() => {
    if (!convSearch.trim()) { setFilteredConvs(conversations); return; }
    const q = convSearch.toLowerCase();
    setFilteredConvs(conversations.filter((c) => {
      const name = `${c.patient?.first_name ?? ""} ${c.patient?.last_name ?? ""}`.toLowerCase();
      return name.includes(q) || c.phone_number.includes(q) || (c.last_message_preview ?? "").toLowerCase().includes(q);
    }));
  }, [convSearch, conversations]);

  // ── Open a conversation ─────────────────────────────────────────────────────
  const openConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setMessages([]);
    setWindowOpen(conv.window_open);
    setWindowExpiresAt(conv.window_expires_at);
    setLoadingMessages(true);
    setError(null);

    // Mark as read
    void fetch(`/api/whatsapp/conversations/${conv.id}/read`, { method: "POST" });

    try {
      const res = await fetch(`/api/whatsapp/conversations/${conv.id}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json() as { messages: Message[]; window_open: boolean; window_expires_at: string | null };
      setMessages(data.messages ?? []);
      setWindowOpen(data.window_open);
      setWindowExpiresAt(data.window_expires_at);
      setTimeout(() => scrollToBottom("instant"), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }

    // Poll messages every 5s
    if (msgPollRef.current) clearInterval(msgPollRef.current);
    msgPollRef.current = setInterval(async () => {
      if (isSendingRef.current) return;
      try {
        const r = await fetch(`/api/whatsapp/conversations/${conv.id}/messages`);
        if (!r.ok) return;
        const d = await r.json() as { messages: Message[]; window_open: boolean; window_expires_at: string | null };
        setMessages((prev) => {
          const incoming = d.messages ?? [];
          if (prev.some((m) => m.id.startsWith("optimistic-"))) return prev;
          const lastPrev = prev[prev.length - 1]?.id;
          const lastIn   = incoming[incoming.length - 1]?.id;
          if (lastPrev === lastIn && prev.length === incoming.length) return prev;
          const lastMsg = incoming[incoming.length - 1];
          const isNew = lastMsg && !prev.some((m) => m.id === lastMsg.id);
          if (isNew && !lastMsg.fromMe) setTimeout(() => scrollToBottom("smooth"), 50);
          return incoming;
        });
        setWindowOpen(d.window_open);
        setWindowExpiresAt(d.window_expires_at);
      } catch { /* ignore */ }
    }, 5000);
  };

  // ── Send a free-form message ────────────────────────────────────────────────
  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConv || !windowOpen) return;
    const text = messageInput.trim();
    setMessageInput("");
    setSending(true);
    setError(null);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId, body: text, fromMe: true, direction: "outbound",
      status: "queued", timestamp: new Date().toISOString(),
      sent_at: null, created_at: new Date().toISOString(),
      media_url: null, template_id: null, message_sid: null,
      delivered_at: null, read_at: null, error_message: null,
      is_demo: false, scheduled_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollToBottom("smooth"), 30);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedConv.patient_id,
          to: selectedConv.phone_number,
          body: text,
        }),
      });
      const result = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error((result as any).error || `Send failed (${res.status})`);
      }
      // Let poll refresh remove optimistic + show real message
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setMessageInput(text);
    } finally {
      setSending(false);
    }
  };

  // ── Group messages by date ──────────────────────────────────────────────────
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const ts = msg.sent_at ?? msg.created_at;
    const dateStr = formatDateGroup(ts);
    if (dateStr !== lastDate) {
      groupedMessages.push({ date: dateStr, messages: [msg] });
      lastDate = dateStr;
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  if (!open) return null;

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200/80 bg-white shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-green-600 to-green-700 px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            {selectedConv ? (
              <button
                onClick={() => {
                  setSelectedConv(null);
                  setMessages([]);
                  if (msgPollRef.current) clearInterval(msgPollRef.current);
                }}
                className="rounded-full p-1 hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <span>{WA_ICON}</span>
            )}
            <div>
              <h2 className="text-sm font-semibold">
                {selectedConv
                  ? (selectedConv.patient
                      ? `${selectedConv.patient.first_name ?? ""} ${selectedConv.patient.last_name ?? ""}`.trim()
                      : selectedConv.phone_number)
                  : "WhatsApp"}
              </h2>
              {!selectedConv && (
                <p className="text-[10px] text-green-100">
                  {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                  {totalUnread > 0 ? ` · ${totalUnread} unread` : ""}
                </p>
              )}
              {selectedConv && (
                <p className="text-[10px] text-green-100">
                  {selectedConv.phone_number}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-green-100 hover:bg-white/20 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Tabs (only when no conversation open) ── */}
        {!selectedConv && (
          <div className="flex border-b border-slate-100 bg-white">
            {(["chats", "sent"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "sent") void loadSentMessages();
                }}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? "border-b-2 border-green-600 bg-green-50 text-green-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {tab}
                {tab === "chats" && totalUnread > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {totalUnread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Conversation list ── */}
        {!selectedConv && activeTab === "chats" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Search */}
            <div className="border-b border-slate-100 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-green-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loadingConvs && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                </div>
              )}
              {!loadingConvs && filteredConvs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <MessageSquare className="mb-2 h-8 w-8" />
                  <p className="text-xs">
                    {convSearch ? "No conversations found" : "No conversations yet"}
                  </p>
                  {!convSearch && (
                    <p className="mt-1 text-[11px] text-slate-400 text-center max-w-[220px]">
                      Conversations appear here when patients reply to your WhatsApp messages.
                    </p>
                  )}
                </div>
              )}
              {filteredConvs.map((conv) => {
                const name = conv.patient
                  ? `${conv.patient.first_name ?? ""} ${conv.patient.last_name ?? ""}`.trim() || conv.phone_number
                  : conv.phone_number;
                const initial = name[0]?.toUpperCase() ?? "?";
                return (
                  <button
                    key={conv.id}
                    onClick={() => void openConversation(conv)}
                    className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 text-sm font-semibold text-white">
                      {initial}
                      {/* Window indicator dot */}
                      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${conv.window_open ? "bg-green-500" : "bg-slate-300"}`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs truncate ${conv.unread_count > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                          {name}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-slate-400">{formatChatTime(conv.last_message_at)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{conv.last_message_preview || "\u00A0"}</p>
                    </div>
                    {/* Unread badge */}
                    {conv.unread_count > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Sent messages tab ── */}
        {!selectedConv && activeTab === "sent" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {loadingSent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-green-600" />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-slate-400">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Sent Messages</p>
                <p className="text-xs text-center text-slate-400 max-w-[220px]">
                  Outbound messages sent from workflows appear as conversations once the patient replies.
                  All sent messages are visible inside each patient&apos;s conversation above.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Message thread ── */}
        {selectedConv && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Window status bar */}
            <div className={`flex items-center gap-2 border-b px-4 py-2 text-[11px] ${
              windowOpen
                ? "border-green-100 bg-green-50 text-green-800"
                : "border-amber-100 bg-amber-50 text-amber-800"
            }`}>
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${windowOpen ? "bg-green-500" : "bg-amber-400"}`} />
              {windowOpen ? (
                <span>24h window open — <strong>{windowLabel(windowExpiresAt)}</strong>. You can send free-form messages.</span>
              ) : (
                <span>Window closed. Only approved templates can be sent (via workflows).</span>
              )}
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto bg-[#e5ddd5] px-3 py-2"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc4' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <p className="text-xs">No messages yet</p>
                </div>
              ) : (
                groupedMessages.map((group, gi) => (
                  <div key={gi}>
                    {/* Date separator */}
                    <div className="my-2 flex justify-center">
                      <span className="rounded-lg bg-white/80 px-3 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">
                        {group.date}
                      </span>
                    </div>
                    {group.messages.map((msg) => {
                      const ts = msg.sent_at ?? msg.created_at;
                      return (
                        <div key={msg.id} className={`mb-1.5 flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs shadow-sm ${
                            msg.fromMe ? "bg-[#dcf8c6] text-slate-800" : "bg-white text-slate-800"
                          } ${msg.id.startsWith("optimistic-") ? "opacity-60" : ""}`}>
                            {/* Template chip */}
                            {msg.template_id && (
                              <p className="mb-0.5 text-[10px] font-semibold text-green-700">Template</p>
                            )}
                            {/* Media */}
                            {msg.media_url && (
                              <img
                                src={msg.media_url}
                                alt=""
                                className="mb-1 max-w-full cursor-pointer rounded-md transition-opacity hover:opacity-90"
                                style={{ maxHeight: 240 }}
                                onClick={() => setPreviewImage(msg.media_url!)}
                              />
                            )}
                            {/* Body */}
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                            {/* Footer: time + status */}
                            <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                              <span>{formatTime(ts)}</span>
                              {msg.fromMe && statusTick(msg.status)}
                            </div>
                            {/* Error */}
                            {msg.error_message && (
                              <p className="mt-0.5 text-[10px] text-red-500">{msg.error_message}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input area ── */}
            {windowOpen ? (
              <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-400/30"
                  style={{ maxHeight: 120, overflowY: "auto" }}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!messageInput.trim() || sending}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-white shadow transition-colors hover:bg-green-700 disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 border-t border-amber-100 bg-amber-50 px-4 py-3">
                <svg className="h-4 w-4 flex-shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <p className="text-[11px] text-amber-800">
                  Window closed. Use a workflow with an approved template to re-engage this patient.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="border-t border-red-100 bg-red-50 px-4 py-2">
                <p className="text-[11px] text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image preview */}
      {previewImage && (
        <ImagePreviewPortal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </>
  );
}
