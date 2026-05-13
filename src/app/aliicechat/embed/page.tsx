"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string;
  created_timestamp: number;
}

const BOOK_URL = "https://aestheticclinic.vercel.app/book-appointment/location";

const T = {
  en: {
    placeholder: "Type your message…",
    error: "Something went wrong. Please try again.",
    online: "Online",
    starting: "Starting chat…",
    book: "Book",
  },
  fr: {
    placeholder: "Tapez votre message…",
    error: "Une erreur s'est produite. Veuillez réessayer.",
    online: "En ligne",
    starting: "Démarrage du chat…",
    book: "Réserver",
  },
};

// Convert URLs in text to clickable links
function linkify(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-500 underline hover:text-sky-600">{part}</a>
    ) : part
  );
}

export default function AliiceChatEmbed() {
  // Get language from URL param or default to en
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = T[lang];

  // Parse URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get("lang");
    if (langParam === "fr") setLang("fr");
    const autoOpen = params.get("open");
    if (autoOpen === "true") setMinimized(false);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Focus input when opened
  useEffect(() => {
    if (!minimized) setTimeout(() => inputRef.current?.focus(), 300);
  }, [minimized]);

  // Start chat session when widget opens
  useEffect(() => {
    if (minimized || chatId) return;
    let cancelled = false;

    async function startChat() {
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/retell/create-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.chat_id) throw new Error(data.error ?? "Failed to start chat");
        setChatId(data.chat_id);
        if (Array.isArray(data.message_with_tool_calls) && data.message_with_tool_calls.length > 0) {
          setMessages(data.message_with_tool_calls.filter((m: Message) => m.role === "agent"));
        }
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setThinking(false);
      }
    }

    startChat();
    return () => { cancelled = true; };
  }, [minimized, chatId, lang]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !chatId || thinking) return;
    setInput("");
    setThinking(true);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, created_timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("/api/retell/chat-completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get response");
      const newMsgs: Message[] = Array.isArray(data.message_with_tool_calls)
        ? data.message_with_tool_calls
        : Array.isArray(data.messages) ? data.messages : [];
      const agentReplies = newMsgs.filter((m: Message) => m.role === "agent");
      if (agentReplies.length > 0) {
        setMessages(prev => [...prev, agentReplies[agentReplies.length - 1]]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: "err-" + Date.now(),
        role: "agent",
        content: t.error,
        created_timestamp: Date.now(),
      }]);
    } finally {
      setThinking(false);
    }
  }, [input, chatId, thinking, t]);

  // Minimized bubble
  if (minimized) {
    return (
      <div className="fixed bottom-5 right-5 z-[9999]">
        <style>{`
          @keyframes embedBounce {
            0% { transform: scale(0) rotate(-10deg); opacity: 0; }
            60% { transform: scale(1.1) rotate(3deg); }
            100% { transform: scale(1) rotate(0); opacity: 1; }
          }
          @keyframes embedPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
            50% { box-shadow: 0 0 0 12px rgba(14,165,233,0); }
          }
          .embed-bubble { animation: embedBounce 0.5s cubic-bezier(0.34,1.56,0.64,1); }
          .embed-bubble:hover { transform: scale(1.08); }
          .embed-pulse { animation: embedPulse 2s ease-in-out infinite; }
        `}</style>
        <button
          onClick={() => setMinimized(false)}
          className="embed-bubble embed-pulse relative w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 shadow-2xl flex items-center justify-center transition-transform cursor-pointer"
          style={{ boxShadow: "0 8px 32px rgba(14,165,233,0.5)" }}
        >
          <Image src="/logos/AliiceAgent.jpg" alt="Chat with Aliice" width={52} height={52} className="rounded-full border-2 border-white/90 object-cover" />
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
        </button>
      </div>
    );
  }

  // Open chat widget - matches exact design of /aliicechat
  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-[380px] max-w-[calc(100vw-40px)] h-[600px] max-h-[calc(100vh-40px)] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={{ boxShadow: "0 25px 60px -12px rgba(0,0,0,0.3)" }}>
      <style>{`
        @keyframes embedSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes embedDot {
          0%,60%,100% { transform:translateY(0); opacity:.45; }
          30%          { transform:translateY(-6px); opacity:1; }
        }
        @keyframes embedMsgIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .embed-window { animation: embedSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        .embed-msg { animation: embedMsgIn 0.22s ease-out both; }
        .embed-dot { animation: embedDot 1.3s ease-in-out infinite; }
        .embed-dot:nth-child(2) { animation-delay:.18s; }
        .embed-dot:nth-child(3) { animation-delay:.36s; }
      `}</style>

      {/* Header - matches /aliicechat */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shadow-sm bg-white flex-shrink-0">
        <div className="relative">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-sky-100">
            <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={40} height={40}
              className="w-full h-full object-cover object-top" />
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 leading-none">Aliice</p>
          <p className="text-[11px] text-emerald-500 font-medium mt-0.5">{t.online}</p>
        </div>
        <div className="flex gap-1.5 shrink-0 items-center">
          {/* Language toggle */}
          <button
            onClick={() => setLang(l => l === "en" ? "fr" : "en")}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all border-2"
            style={{
              borderColor: lang === "en" ? "#dbeafe" : "#e0e7ff",
              background: lang === "en" ? "#eff6ff" : "#eef2ff",
              color: lang === "en" ? "#3b82f6" : "#6366f1",
            }}
          >
            {lang === "en" ? "🇬🇧 EN" : "🇫🇷 FR"}
          </button>
          {/* Book button */}
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-full transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t.book}
          </a>
          {/* Minimize */}
          <button onClick={() => setMinimized(true)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area - matches /aliicechat */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ background: "#f8fafc" }}>
        {error && (
          <div className="text-center text-xs text-rose-500 bg-rose-50 rounded-xl py-2 px-4">{error}</div>
        )}
        {messages.length === 0 && !thinking && !error && (
          <div className="flex justify-center pt-12">
            <p className="text-xs text-slate-400">{t.starting}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id ?? msg.created_timestamp}
            className={`embed-msg flex gap-2.5 ${ msg.role === "user" ? "justify-end" : "justify-start" }`}>
            {msg.role === "agent" && (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end mb-0.5 shadow-sm">
                <Image src="/logos/AliiceAgent.jpg" alt="" width={32} height={32}
                  className="w-full h-full object-cover object-top" />
              </div>
            )}
            <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === "user"
                ? "bg-sky-500 text-white rounded-br-sm"
                : "bg-white text-slate-800 rounded-bl-sm border border-slate-100"
            }`}>
              {msg.role === "agent" ? linkify(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {thinking && (
          <div className="embed-msg flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end mb-0.5 shadow-sm">
              <Image src="/logos/AliiceAgent.jpg" alt="" width={32} height={32}
                className="w-full h-full object-cover object-top" />
            </div>
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1.5">
              <span className="embed-dot w-2 h-2 rounded-full bg-slate-400 block" />
              <span className="embed-dot w-2 h-2 rounded-full bg-slate-400 block" />
              <span className="embed-dot w-2 h-2 rounded-full bg-slate-400 block" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar - matches /aliicechat */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={t.placeholder}
          disabled={!chatId || thinking}
          className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !chatId || thinking}
          className="w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow"
        >
          <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
