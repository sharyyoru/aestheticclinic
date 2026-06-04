"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatSwissDateTime } from "@/lib/swissTimezone";

interface Message {
  id: string;
  body: string;
  direction: "inbound" | "outbound";
  status: string;
  sent_at: string | null;
  created_at: string;
  media_url?: string | null;
  template_sid?: string | null;
}

interface Conversation {
  last_inbound_at: string | null;
  window_expires_at: string | null;
}

interface WhatsAppTwilioChatProps {
  patientId: string;
  patientPhone: string | null;
  patientName?: string;
}

export default function WhatsAppTwilioChat({
  patientId,
  patientPhone,
  patientName = "Patient",
}: WhatsAppTwilioChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [windowTimeLeft, setWindowTimeLeft] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate if 24h window is open
  const checkWindow = useCallback(() => {
    if (!conversation?.window_expires_at) {
      setWindowOpen(false);
      setWindowTimeLeft(null);
      return;
    }
    const expires = new Date(conversation.window_expires_at);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff > 0) {
      setWindowOpen(true);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setWindowTimeLeft(`${hours}h ${mins}m`);
    } else {
      setWindowOpen(false);
      setWindowTimeLeft(null);
    }
  }, [conversation]);

  useEffect(() => {
    checkWindow();
    const interval = setInterval(checkWindow, 60000);
    return () => clearInterval(interval);
  }, [checkWindow]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!patientId) return;

    try {
      const { data, error: fetchError } = await supabaseClient
        .from("whatsapp_messages")
        .select("id, body, direction, status, sent_at, created_at, media_url, template_sid")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      setMessages(data || []);

      // Load conversation for window status
      const { data: convData } = await supabaseClient
        .from("whatsapp_conversations")
        .select("last_inbound_at, window_expires_at")
        .eq("patient_id", patientId)
        .single();

      if (convData) {
        setConversation(convData);
      }
    } catch (err: any) {
      console.error("Failed to load messages:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadMessages();

    // Poll for new messages every 10 seconds
    pollIntervalRef.current = setInterval(loadMessages, 10000);

    // Subscribe to realtime updates
    const channel = supabaseClient
      .channel(`whatsapp-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      supabaseClient.removeChannel(channel);
    };
  }, [patientId, loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!messageInput.trim() || !patientPhone || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: patientPhone,
          body: messageInput.trim(),
          patientId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send message");
      }

      setMessageInput("");
      // Reload to get the new message
      loadMessages();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Send template message
  const handleSendTemplate = async (templateSid: string) => {
    if (!patientPhone || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: patientPhone,
          contentSid: templateSid,
          contentVariables: { "1": patientName.split(" ")[0] || "there" },
          patientId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send template");
      }

      loadMessages();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!patientPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <svg className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <h3 className="font-medium text-slate-900">No phone number</h3>
        <p className="mt-1 text-sm text-slate-500">
          Add a phone number to this patient to enable WhatsApp messaging.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with window status */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-medium">
            {patientName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{patientName}</p>
            <p className="text-[10px] text-slate-500">{patientPhone}</p>
          </div>
        </div>
        <div className="text-right">
          {windowOpen ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              24h window open · {windowTimeLeft}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Window closed — templates only
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#e5ddd5]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="h-10 w-10 text-slate-400 mb-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <p className="text-sm text-slate-500">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Send a template message to start the conversation
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                  msg.direction === "outbound"
                    ? "bg-[#dcf8c6] rounded-br-none"
                    : "bg-white rounded-bl-none"
                }`}
              >
                {msg.template_sid && (
                  <p className="text-[9px] text-slate-400 mb-1">📋 Template message</p>
                )}
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.body}</p>
                {msg.media_url && (
                  <a
                    href={msg.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-xs text-blue-600 underline"
                  >
                    📎 View attachment
                  </a>
                )}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-slate-400">
                    {formatSwissDateTime(msg.sent_at || msg.created_at)}
                  </span>
                  {msg.direction === "outbound" && (
                    <span className="text-[10px]">
                      {msg.status === "delivered" ? "✓✓" : msg.status === "sent" ? "✓" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white p-3">
        {!windowOpen && (
          <div className="mb-3">
            <p className="text-[11px] text-slate-500 mb-2">
              The 24-hour window is closed. Send a template message to re-open it:
            </p>
            <button
              type="button"
              onClick={() => handleSendTemplate("HXdff188b222fe82c18233b2422dd04792")}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              📅 Send Booking Link
            </button>
          </div>
        )}
        
        <div className="flex items-end gap-2">
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={windowOpen ? "Type a message..." : "Window closed — use template above"}
            disabled={!windowOpen || sending}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30 disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!windowOpen || !messageInput.trim() || sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
