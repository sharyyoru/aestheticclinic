"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

const BOOK_URL = "https://aestheticclinic.vercel.app/book-appointment/location";
const CLINIC_PHONE = "+41 22 732 22 23";
const CLINIC_PHONE_TEL = "+41227322223";

type Lang = "en" | "fr";

const T = {
  en: {
    greeting: "Hi, I\u2019m Aliice",
    subtitle: "Your AI assistant at",
    clinic: "Aesthetics Clinic Geneva",
    question: "How can I help you today?",
    book: "Book Appointment",
    callUs: "Call Clinic",
    chat: "Chat with Aliice",
    getCall: "Get a Call",
    getCallDesc: "Talk to Aliice",
    currency: "All prices are in",
    currencyName: "CHF (Swiss Francs)",
    online: "Online \u00b7 Aesthetics Clinic Geneva",
    bookShort: "Book",
    callShort: "Call",
    voiceShort: "Voice",
    placeholder: "Ask a detailed question\u2026",
    starting: "Starting conversation\u2026",
    error: "Sorry, something went wrong. Please try again.",
    connecting: "Calling you now...",
    inCall: "Aliice is calling you!",
    endCall: "End Call",
    callEnded: "Call initiated!",
    phoneLabel: "Your phone number",
    phonePlaceholder: "+41 79 123 45 67",
    requestCall: "Call me now",
    callMeBack: "We'll call you right away",
    back: "Back",
  },
  fr: {
    greeting: "Bonjour, je suis Aliice",
    subtitle: "Votre assistante IA \u00e0 la",
    clinic: "Clinique Esth\u00e9tique Gen\u00e8ve",
    question: "Comment puis-je vous aider aujourd\u2019hui\u00a0?",
    book: "Prendre RDV",
    callUs: "Appeler la clinique",
    chat: "Discuter avec Aliice",
    getCall: "\u00catre rappel\u00e9(e)",
    getCallDesc: "Parlez \u00e0 Aliice",
    currency: "Tous les prix sont en",
    currencyName: "CHF (francs suisses)",
    online: "En ligne \u00b7 Clinique Esth\u00e9tique Gen\u00e8ve",
    bookShort: "RDV",
    callShort: "Appeler",
    voiceShort: "Voix",
    placeholder: "Posez une question d\u00e9taill\u00e9e\u2026",
    starting: "D\u00e9marrage de la conversation\u2026",
    error: "D\u00e9sol\u00e9, une erreur est survenue. Veuillez r\u00e9essayer.",
    connecting: "Appel en cours...",
    inCall: "Aliice vous appelle\u00a0!",
    endCall: "Raccrocher",
    callEnded: "Appel lanc\u00e9\u00a0!",
    phoneLabel: "Votre num\u00e9ro de t\u00e9l\u00e9phone",
    phonePlaceholder: "+41 79 123 45 67",
    requestCall: "Appelez-moi maintenant",
    callMeBack: "Nous vous rappelons imm\u00e9diatement",
    back: "Retour",
  },
} as const;

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
  const [lang, setLang] = useState<Lang>("en");
  const [screen, setScreen] = useState<"welcome" | "chat" | "call">("welcome");
  const [dismissing, setDismissing] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<"idle" | "form" | "calling" | "success">("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const t = T[lang];

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
        const res = await fetch("/api/retell/create-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang }),
        });
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
  }, [screen, lang]);

  // Focus phone input when call screen opens
  useEffect(() => {
    if (screen === "call" && callStatus === "form") {
      setTimeout(() => phoneInputRef.current?.focus(), 300);
    }
  }, [screen, callStatus]);

  const requestPhoneCall = useCallback(async () => {
    const phone = phoneNumber.trim().replace(/\s/g, "");
    if (!phone || phone.length < 8) {
      setError(lang === "fr" ? "Veuillez entrer un numéro valide" : "Please enter a valid phone number");
      return;
    }
    setCallStatus("calling");
    setError(null);
    try {
      const res = await fetch("/api/retell/create-web-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, phone_number: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate call");
      setCallStatus("success");
      setTimeout(() => {
        setScreen("welcome");
        setCallStatus("idle");
        setPhoneNumber("");
      }, 4000);
    } catch (e: unknown) {
      setError((e as Error).message);
      setCallStatus("form");
    }
  }, [phoneNumber, lang]);

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
      // Retell returns message_with_tool_calls with the full updated message list
      const newMsgs: Message[] = Array.isArray(data.message_with_tool_calls)
        ? data.message_with_tool_calls
        : Array.isArray(data.messages) ? data.messages : [];
      const agentReplies = newMsgs.filter((m: Message) => m.role === "agent");
      // Only append the last agent message (the new reply)
      if (agentReplies.length > 0) {
        setMessages(prev => [...prev, agentReplies[agentReplies.length - 1]]);
      }
    } catch (e: unknown) {
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

  const handleStartChat = () => {
    setDismissing(true);
    setTimeout(() => setScreen("chat"), 280);
  };

  const handleStartCall = () => {
    setDismissing(true);
    setCallStatus("form");
    setError(null);
    setTimeout(() => setScreen("call"), 280);
  };

  const handleBackFromCall = () => {
    setScreen("welcome");
    setCallStatus("idle");
    setPhoneNumber("");
    setError(null);
  };

  // Language toggle button (reused in all screens)
  const LangToggle = ({ size = "sm" }: { size?: "sm" | "lg" }) => (
    <button
      onClick={() => setLang(l => l === "en" ? "fr" : "en")}
      className={`flex items-center gap-1.5 font-bold tracking-wide border-2 rounded-full transition-all select-none hover:scale-105 active:scale-95 ${
        size === "lg" ? "text-sm px-4 py-2" : "text-[11px] px-3 py-1.5"
      }`}
      style={{
        borderColor: "#0ea5e9",
        color: lang === "en" ? "#fff" : "#0ea5e9",
        background: lang === "en" ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : "#fff",
        boxShadow: lang === "en" ? "0 4px 12px rgba(14,165,233,.25)" : "0 2px 8px rgba(0,0,0,.08)",
      }}
      title={lang === "en" ? "Passer en fran\u00e7ais" : "Switch to English"}
    >
      <span className={lang === "en" ? "opacity-100" : "opacity-40"}>EN</span>
      <span className="opacity-20">|</span>
      <span className={lang === "fr" ? "opacity-100" : "opacity-40"}>FR</span>
    </button>
  );

  // ── Call screen (phone number form) ─────────────────────────────────────────
  if (screen === "call") {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center px-5"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}>
        <style>{`
          @keyframes aliicePulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.15); opacity: 0.3; }
          }
          @keyframes aliiceGlow {
            0%, 100% { box-shadow: 0 0 30px rgba(139,92,246,0.4); }
            50% { box-shadow: 0 0 60px rgba(139,92,246,0.7); }
          }
          @keyframes aliiceCheck {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); opacity: 1; }
          }
          .aliice-ring { animation: aliicePulse 2s ease-in-out infinite; }
          .aliice-glow { animation: aliiceGlow 2s ease-in-out infinite; }
          .aliice-check { animation: aliiceCheck 0.5s ease-out both; }
        `}</style>

        {/* Back button */}
        {callStatus === "form" && (
          <button onClick={handleBackFromCall}
            className="absolute top-5 left-5 flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.back}
          </button>
        )}

        {/* Language toggle */}
        <div className="absolute top-5 right-5">
          <LangToggle />
        </div>

        {/* Pulsing rings for success */}
        {callStatus === "success" && (
          <>
            <div className="absolute w-48 h-48 rounded-full border-2 border-emerald-400/30 aliice-ring" />
            <div className="absolute w-64 h-64 rounded-full border border-emerald-400/20 aliice-ring" style={{ animationDelay: "0.5s" }} />
          </>
        )}

        {/* Avatar */}
        <div className={`relative mb-6 ${callStatus === "success" ? "aliice-glow" : ""}`}
          style={{ borderRadius: "50%" }}>
          <div className="w-28 h-28 rounded-full overflow-hidden" style={{ border: "4px solid rgba(139,92,246,0.5)" }}>
            <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={112} height={112}
              className="w-full h-full object-cover object-top" priority />
          </div>
          {callStatus === "success" && (
            <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-emerald-400 border-2 border-slate-900 shadow flex items-center justify-center aliice-check">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          {callStatus === "form" ? t.getCall :
           callStatus === "calling" ? t.connecting :
           t.callEnded}
        </h2>
        <p className="text-violet-300/70 text-sm mb-8">{t.callMeBack}</p>

        {/* Error message */}
        {error && (
          <div className="text-rose-400 text-sm mb-4 bg-rose-500/10 px-4 py-2 rounded-full">{error}</div>
        )}

        {/* Phone input form */}
        {callStatus === "form" && (
          <div className="w-full max-w-[320px] space-y-4">
            <div>
              <label className="block text-slate-400 text-sm mb-2">{t.phoneLabel}</label>
              <input
                ref={phoneInputRef}
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestPhoneCall()}
                placeholder={t.phonePlaceholder}
                className="w-full bg-slate-800/50 border-2 border-slate-600 focus:border-violet-500 rounded-xl px-4 py-3.5 text-white text-lg placeholder:text-slate-500 outline-none transition-colors"
              />
            </div>
            <button onClick={requestPhoneCall}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold text-base transition-all active:scale-[0.98] shadow-lg"
              style={{ boxShadow: "0 10px 30px -8px rgba(139,92,246,.5)" }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {t.requestCall}
            </button>
          </div>
        )}

        {/* Calling spinner */}
        {callStatus === "calling" && (
          <div className="flex items-center gap-3 text-violet-300">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-base">{t.connecting}</span>
          </div>
        )}

        {/* Success message */}
        {callStatus === "success" && (
          <div className="text-center">
            <p className="text-emerald-400 text-lg font-semibold mb-2">{t.inCall}</p>
            <p className="text-slate-400 text-sm">{lang === "fr" ? "Veuillez r\u00e9pondre \u00e0 votre t\u00e9l\u00e9phone" : "Please answer your phone"}</p>
          </div>
        )}
      </main>
    );
  }

  // ── Welcome screen ─────────────────────────────────────────────────────────
  if (screen === "welcome") {
    return (
      <main
        className="fixed inset-0 flex items-center justify-center px-5"
        style={{ background: "linear-gradient(160deg,#f8fafc 0%,#fff 55%,#f0f9ff 100%)" }}
      >
        <style>{`
          @keyframes aliiceSlideUp {
            from { opacity:0; transform:translateY(32px) scale(0.95); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
          @keyframes aliiceFadeOut {
            to { opacity:0; transform:translateY(16px) scale(0.98); }
          }
          @keyframes aliiceFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes aliiceShine {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          .aliice-welcome { animation: aliiceSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
          .aliice-welcome.out { animation: aliiceFadeOut 0.26s ease-in forwards; }
          .aliice-float { animation: aliiceFloat 3s ease-in-out infinite; }
          .aliice-btn { transition: all 0.2s ease; }
          .aliice-btn:hover { transform: translateY(-2px); }
          .aliice-btn:active { transform: translateY(0) scale(0.98); }
          .aliice-shine {
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            background-size: 200% 100%;
            animation: aliiceShine 3s linear infinite;
          }
        `}</style>

        {/* Language toggle — top right */}
        <div className="fixed top-5 right-5 z-10">
          <LangToggle size="lg" />
        </div>

        <div className={`aliice-welcome w-full max-w-[380px] flex flex-col items-center${dismissing ? " out" : ""}`}>
          {/* Avatar with float animation */}
          <div className="relative mb-6 aliice-float">
            <div className="w-28 h-28 rounded-full overflow-hidden shadow-2xl ring-4 ring-white"
              style={{ boxShadow: "0 20px 50px -15px rgba(14,165,233,0.35)" }}>
              <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={112} height={112}
                className="w-full h-full object-cover object-top" priority />
            </div>
            <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-400 border-[3px] border-white shadow-lg" />
          </div>

          <h1 className="text-3xl font-bold text-slate-800 mb-2 text-center tracking-tight">{t.greeting}</h1>
          <p className="text-slate-500 text-[15px] text-center mb-8 leading-relaxed max-w-[280px]">
            {t.subtitle} <span className="font-semibold text-slate-700">{t.clinic}</span>.<br />
            {t.question}
          </p>

          <div className="w-full space-y-3 mb-8">
            {/* Book Appointment - Primary CTA */}
            <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
              className="aliice-btn relative overflow-hidden flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl text-white font-semibold text-[15px]"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#0284c7)", boxShadow: "0 10px 30px -8px rgba(14,165,233,.45)" }}>
              <div className="absolute inset-0 aliice-shine" />
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t.book}
            </a>

            {/* Two buttons side by side */}
            <div className="flex gap-3">
              {/* Chat with Aliice */}
              <button onClick={handleStartChat}
                className="aliice-btn flex-1 flex items-center justify-center gap-2.5 py-4 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[14px] shadow-lg">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {t.chat}
              </button>

              {/* Get A Call - Voice call */}
              <button onClick={handleStartCall}
                className="aliice-btn flex-1 flex items-center justify-center gap-2.5 py-4 px-5 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold text-[14px] shadow-lg"
                style={{ boxShadow: "0 10px 25px -8px rgba(139,92,246,.4)" }}>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                {t.getCall}
              </button>
            </div>

            {/* Call Clinic */}
            <a href={`tel:${CLINIC_PHONE_TEL}`}
              className="aliice-btn flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-2xl bg-white text-slate-600 font-medium text-[14px] border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50">
              <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {t.callUs}: <span className="text-slate-800 font-semibold">{CLINIC_PHONE}</span>
            </a>
          </div>

          <p className="text-xs text-slate-400 text-center">
            {t.currency} <strong className="text-slate-500">CHF</strong> ({lang === "en" ? "Swiss Francs" : "francs suisses"})
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
          <LangToggle />
          <button onClick={handleStartCall}
            className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-full transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            {t.voiceShort}
          </button>
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-full transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t.bookShort}
          </a>
          <a href={`tel:${CLINIC_PHONE_TEL}`}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-full transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {t.callShort}
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
            <p className="text-xs text-slate-400">{t.starting}</p>
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
    </main>
  );
}
