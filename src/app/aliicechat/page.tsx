"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

const BOOK_URL = "https://aestheticclinic.vercel.app/book-appointment/location";
const CLINIC_PHONE = "+41 22 732 22 23";
const CLINIC_PHONE_TEL = "+41227322223";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string;
  created_timestamp: number;
}

// ── Linkify: convert URLs and phone numbers in text to clickable elements
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)|(\+[\d][\d\s\-.()]{5,20}[\d])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      parts.push(<a key={key++} href={m[2]} target="_blank" rel="noopener noreferrer" className="underline text-sky-500 hover:text-sky-700 break-all">{m[1]}</a>);
    } else if (m[3]) {
      parts.push(<a key={key++} href={m[3]} target="_blank" rel="noopener noreferrer" className="underline text-sky-500 hover:text-sky-700 break-all">{m[3]}</a>);
    } else if (m[4]) {
      parts.push(<a key={key++} href={`tel:${m[4].replace(/[\s\-().]/g, "")}`} className="underline text-sky-500 hover:text-sky-700 font-medium">{m[4]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function AliiceChatPage() {
  const [screen, setScreen] = useState<"welcome" | "chat">("welcome");
  const [dismissing, setDismissing] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Focus input when chat opens
  useEffect(() => {
    if (screen === "chat") setTimeout(() => inputRef.current?.focus(), 300);
  }, [screen]);

  // Start a Retell chat session on mount of chat screen
  useEffect(() => {
    if (screen !== "chat") return;
    let cancelled = false;

    async function startChat() {
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/retell/create-chat", { method: "POST" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.chat_id) throw new Error(data.error ?? "Failed to start chat");
        setChatId(data.chat_id);
        // The initial agent message comes in message_with_tool_calls
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
  }, [screen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !chatId || thinking) return;
    setInput("");
    setThinking(true);

    // Optimistic user message
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
      // data.messages is array of new messages from agent
      if (Array.isArray(data.messages)) {
        setMessages(prev => [
          ...prev,
          ...data.messages.filter((m: Message) => m.role === "agent"),
        ]);
      }
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        id: "err-" + Date.now(),
        role: "agent",
        content: "Sorry, something went wrong. Please try again.",
        created_timestamp: Date.now(),
      }]);
    } finally {
      setThinking(false);
    }
  }, [input, chatId, thinking]);

  const handleStartChat = () => {
    setDismissing(true);
    setTimeout(() => setScreen("chat"), 280);
  };

  // ── Welcome screen ─────────────────────────────────────────────────────────
  if (screen === "welcome") {
    return (
      <main
        className="fixed inset-0 flex items-center justify-center px-5"
        style={{ background: "linear-gradient(160deg,#f8fafc 0%,#fff 55%,#f0f9ff 100%)" }}
      >
        <style>{`
          @keyframes aliiceSlideUp {
            from { opacity:0; transform:translateY(32px); }
            to   { opacity:1; transform:translateY(0); }
          }
          @keyframes aliiceFadeOut {
            to { opacity:0; transform:translateY(16px); }
          }
          .aliice-welcome { animation: aliiceSlideUp 0.38s cubic-bezier(0.34,1.56,0.64,1) both; }
          .aliice-welcome.out { animation: aliiceFadeOut 0.26s ease-in forwards; }
        `}</style>

        <div className={`aliice-welcome w-full max-w-[340px] flex flex-col items-center${dismissing ? " out" : ""}`}>
          {/* Avatar */}
          <div className="relative mb-5">
            <div className="w-[112px] h-[112px] rounded-full overflow-hidden shadow-2xl" style={{ border: "4px solid #e0f2fe" }}>
              <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={112} height={112}
                className="w-full h-full object-cover object-top" priority />
            </div>
            <span className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow" />
          </div>

          <h1 className="text-[1.65rem] font-semibold text-slate-800 mb-1 text-center tracking-tight">Hi, I&apos;m Aliice</h1>
          <p className="text-slate-500 text-sm text-center mb-7 leading-relaxed max-w-[260px]">
            Your AI assistant at <span className="font-semibold text-slate-700">Aesthetics Clinic Geneva</span>.<br />
            How can I help you today?
          </p>

          <div className="w-full space-y-3 mb-6">
            <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-[15px] px-6 rounded-2xl text-white font-medium text-[15px] transition-all active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)", boxShadow: "0 8px 24px rgba(14,165,233,.32)" }}>
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book an Appointment
            </a>

            <a href={`tel:${CLINIC_PHONE_TEL}`}
              className="flex items-center justify-center gap-3 w-full py-[15px] px-6 rounded-2xl bg-white text-slate-700 font-medium text-[15px] border border-slate-200 shadow-sm transition-all active:scale-[0.97] hover:bg-slate-50">
              <svg className="w-5 h-5 shrink-0 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call Us <span className="text-sky-600 font-semibold">{CLINIC_PHONE}</span>
            </a>

            <button onClick={handleStartChat}
              className="flex items-center justify-center gap-2.5 w-full py-[15px] px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-[15px] transition-all active:scale-[0.97] shadow-lg">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat with Aliice
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            All prices are in <strong className="text-slate-500">CHF</strong> (Swiss Francs)
          </p>
        </div>
      </main>
    );
  }

  // ── Chat screen ─────────────────────────────────────────────────────────────
  return (
    <main className="fixed inset-0 flex flex-col bg-white">
      <style>{`
        @keyframes aliiceDot {
          0%,60%,100% { transform:translateY(0); opacity:.45; }
          30%          { transform:translateY(-6px); opacity:1; }
        }
        @keyframes aliiceMsgIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .aliice-msg { animation: aliiceMsgIn 0.22s ease-out both; }
        .aliice-dot { animation: aliiceDot 1.3s ease-in-out infinite; }
        .aliice-dot:nth-child(2) { animation-delay:.18s; }
        .aliice-dot:nth-child(3) { animation-delay:.36s; }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 shadow-sm bg-white flex-shrink-0">
        <div className="relative">
          <div className="w-10 h-10 rounded-full overflow-hidden">
            <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={40} height={40}
              className="w-full h-full object-cover object-top" />
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-none">Aliice</p>
          <p className="text-[11px] text-emerald-500 font-medium mt-0.5">Online · Aesthetics Clinic Geneva</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-full transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Book
          </a>
          <a href={`tel:${CLINIC_PHONE_TEL}`}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call
          </a>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ background: "#f8fafc" }}>
        {error && (
          <div className="text-center text-xs text-rose-500 bg-rose-50 rounded-xl py-2 px-4">{error}</div>
        )}
        {messages.length === 0 && !thinking && !error && (
          <div className="flex justify-center pt-12">
            <p className="text-xs text-slate-400">Starting conversation…</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id ?? msg.created_timestamp}
            className={`aliice-msg flex gap-2.5 ${ msg.role === "user" ? "justify-end" : "justify-start" }`}>
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
          <div className="aliice-msg flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end mb-0.5 shadow-sm">
              <Image src="/logos/AliiceAgent.jpg" alt="" width={32} height={32}
                className="w-full h-full object-cover object-top" />
            </div>
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1.5">
              <span className="aliice-dot w-2 h-2 rounded-full bg-slate-400 block" />
              <span className="aliice-dot w-2 h-2 rounded-full bg-slate-400 block" />
              <span className="aliice-dot w-2 h-2 rounded-full bg-slate-400 block" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask a detailed question…"
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
    </main>
  );
}
