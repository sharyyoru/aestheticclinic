"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { RetellWebClient } from "retell-client-js-sdk";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string;
  created_timestamp: number;
}

const BOOK_URL = "https://aestheticclinic.vercel.app/book-appointment/location";
const CLINIC_PHONE = "+41 22 732 22 23";

type Screen = "welcome" | "chat" | "call" | "webcall";
type Lang = "en" | "fr";

const T = {
  en: {
    placeholder: "Type your message…",
    error: "Something went wrong. Please try again.",
    online: "Online",
    starting: "Starting chat…",
    book: "Book",
    greeting: "Hi, I'm Aliice",
    subtitle: "Your AI assistant",
    question: "How can I help you today?",
    chat: "Chat with me",
    speakNow: "Speak with me",
    getCall: "Get a call",
    phoneLabel: "Your phone number",
    phonePlaceholder: "+41 79 123 45 67",
    requestCall: "Call me now",
    back: "Back",
    connecting: "Connecting...",
    inCall: "Speaking with Aliice",
    endCall: "End Call",
    callEnded: "Call ended",
    calling: "Calling you...",
    callSuccess: "Call initiated!",
  },
  fr: {
    placeholder: "Tapez votre message…",
    error: "Une erreur s'est produite. Veuillez réessayer.",
    online: "En ligne",
    starting: "Démarrage du chat…",
    book: "RDV",
    greeting: "Bonjour, je suis Aliice",
    subtitle: "Votre assistante IA",
    question: "Comment puis-je vous aider?",
    chat: "Discuter avec moi",
    speakNow: "Me parler",
    getCall: "Être rappelé(e)",
    phoneLabel: "Votre numéro",
    phonePlaceholder: "+41 79 123 45 67",
    requestCall: "Appelez-moi",
    back: "Retour",
    connecting: "Connexion...",
    inCall: "En ligne avec Aliice",
    endCall: "Raccrocher",
    callEnded: "Appel terminé",
    calling: "Appel en cours...",
    callSuccess: "Appel lancé!",
  },
};

// Convert URLs in text to clickable links
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(https?:\/\/[^\s<>"']+)|(\+[\d][\d\s\-.()]{5,20}[\d])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      parts.push(<a key={key++} href={m[1]} target="_blank" rel="noopener noreferrer" className="underline text-sky-500 hover:text-sky-700">{m[1]}</a>);
    } else if (m[2]) {
      parts.push(<a key={key++} href={`tel:${m[2].replace(/[\s\-().]/g, "")}`} className="underline text-sky-500 hover:text-sky-700">{m[2]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function AliiceChatEmbed() {
  const [lang, setLang] = useState<Lang>("en");
  const [minimized, setMinimized] = useState(true);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "success">("idle");
  const [webCallStatus, setWebCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const retellClientRef = useRef<RetellWebClient | null>(null);
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

  // Focus input when chat opens
  useEffect(() => {
    if (screen === "chat") setTimeout(() => inputRef.current?.focus(), 300);
  }, [screen]);

  // Focus phone input when call screen opens
  useEffect(() => {
    if (screen === "call") setTimeout(() => phoneInputRef.current?.focus(), 300);
  }, [screen]);

  // Start chat session when chat screen opens
  useEffect(() => {
    if (screen !== "chat" || chatId) return;
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
  }, [screen, chatId, lang]);

  // Web call effect
  useEffect(() => {
    if (screen !== "webcall") return;
    let cancelled = false;

    async function startWebCall() {
      setWebCallStatus("connecting");
      setError(null);
      try {
        const res = await fetch("/api/retell/web-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.access_token) throw new Error(data.error ?? "Failed to start call");

        const client = new RetellWebClient();
        retellClientRef.current = client;

        client.on("call_started", () => setWebCallStatus("active"));
        client.on("call_ended", () => {
          setWebCallStatus("ended");
          setTimeout(() => {
            setScreen("welcome");
            setWebCallStatus("idle");
          }, 2000);
        });
        client.on("error", (e) => {
          console.error("Retell error:", e);
          setError(t.error);
          setWebCallStatus("ended");
        });

        await client.startCall({ accessToken: data.access_token });
      } catch (e: unknown) {
        if (!cancelled) {
          setError((e as Error).message);
          setWebCallStatus("ended");
        }
      }
    }

    startWebCall();
    return () => {
      cancelled = true;
      if (retellClientRef.current) {
        retellClientRef.current.stopCall();
        retellClientRef.current = null;
      }
    };
  }, [screen, lang, t.error]);

  const endWebCall = useCallback(() => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
      retellClientRef.current = null;
    }
    setWebCallStatus("ended");
    setTimeout(() => {
      setScreen("welcome");
      setWebCallStatus("idle");
    }, 1500);
  }, []);

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
      setCallStatus("idle");
    }
  }, [phoneNumber, lang]);

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

  // Global styles
  const globalStyles = `
    @keyframes embedBounce {
      0% { transform: scale(0) rotate(-10deg); opacity: 0; }
      60% { transform: scale(1.1) rotate(3deg); }
      100% { transform: scale(1) rotate(0); opacity: 1; }
    }
    @keyframes embedPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
      50% { box-shadow: 0 0 0 12px rgba(14,165,233,0); }
    }
    @keyframes embedMsgBounce {
      0% { transform: scale(0) translateX(20px); opacity: 0; }
      60% { transform: scale(1.05) translateX(-3px); }
      100% { transform: scale(1) translateX(0); opacity: 1; }
    }
    @keyframes embedDot {
      0%,60%,100% { transform:translateY(0); opacity:.45; }
      30%          { transform:translateY(-6px); opacity:1; }
    }
    @keyframes embedMsgIn {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    .embed-bubble { animation: embedBounce 0.5s cubic-bezier(0.34,1.56,0.64,1); }
    .embed-bubble:hover { transform: scale(1.08); }
    .embed-pulse { animation: embedPulse 2s ease-in-out infinite; }
    .embed-msg-bubble { animation: embedMsgBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both; }
    .embed-msg { animation: embedMsgIn 0.22s ease-out both; }
    .embed-dot { animation: embedDot 1.3s ease-in-out infinite; }
    .embed-dot:nth-child(2) { animation-delay:.18s; }
    .embed-dot:nth-child(3) { animation-delay:.36s; }
  `;

  // Minimized bubble
  if (minimized) {
    return (
      <div className="fixed bottom-5 right-5 z-[9999] flex items-end gap-3">
        <style>{globalStyles}</style>
        <div onClick={() => setMinimized(false)}
          className="embed-msg-bubble cursor-pointer bg-white rounded-2xl rounded-br-sm px-4 py-3 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
          <p className="text-sm font-medium text-slate-800">
            {lang === "fr" ? "Parler avec Aliice 💬" : "Speak to Aliice 💬"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === "fr" ? "Je suis là pour vous aider!" : "I'm here to help!"}
          </p>
        </div>
        <button onClick={() => setMinimized(false)}
          className="embed-bubble embed-pulse relative w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 shadow-2xl flex items-center justify-center transition-transform cursor-pointer flex-shrink-0"
          style={{ boxShadow: "0 8px 32px rgba(14,165,233,0.5)" }}>
          <Image src="/logos/AliiceAgent.jpg" alt="Chat with Aliice" width={52} height={52} className="rounded-full border-2 border-white/90 object-cover" />
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
        </button>
      </div>
    );
  }

  // Widget container
  const WidgetContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed bottom-5 right-5 z-[9999] w-[380px] max-w-[calc(100vw-40px)] h-[580px] max-h-[calc(100vh-40px)] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={{ boxShadow: "0 25px 60px -12px rgba(0,0,0,0.3)" }}>
      <style>{globalStyles}</style>
      {children}
    </div>
  );

  // Header component
  const Header = ({ showBack = false, onBack }: { showBack?: boolean; onBack?: () => void }) => (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shadow-sm bg-white flex-shrink-0">
      {showBack && onBack && (
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className="relative">
        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-sky-100">
          <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={40} height={40} className="w-full h-full object-cover object-top" />
        </div>
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 leading-none">Aliice</p>
        <p className="text-[11px] text-emerald-500 font-medium mt-0.5">{t.online}</p>
      </div>
      <div className="flex gap-1.5 shrink-0 items-center">
        <button onClick={() => setLang(l => l === "en" ? "fr" : "en")}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all border-2"
          style={{ borderColor: lang === "en" ? "#dbeafe" : "#e0e7ff", background: lang === "en" ? "#eff6ff" : "#eef2ff", color: lang === "en" ? "#3b82f6" : "#6366f1" }}>
          {lang === "en" ? "🇬🇧 EN" : "🇫🇷 FR"}
        </button>
        <button onClick={() => setMinimized(true)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );

  // Welcome screen
  if (screen === "welcome") {
    return (
      <WidgetContainer>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #e0f2fe 100%)" }}>
          <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-sky-100 shadow-lg mb-4">
            <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={80} height={80} className="w-full h-full object-cover object-top" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">{t.greeting}</h2>
          <p className="text-sm text-slate-500 mb-6">{t.question}</p>
          
          <div className="w-full space-y-3">
            {/* Chat button */}
            <button onClick={() => setScreen("chat")}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors shadow-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {t.chat}
            </button>
            
            {/* Voice call button */}
            <button onClick={() => setScreen("webcall")}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm transition-colors shadow-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {t.speakNow}
            </button>
            
            {/* Phone call button */}
            <button onClick={() => setScreen("call")}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold text-sm transition-colors shadow-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {t.getCall}
            </button>
            
            {/* Book appointment */}
            <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-sm transition-colors border-2 border-sky-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t.book}
            </a>
          </div>
          
          <p className="text-xs text-slate-400 mt-6">📞 {CLINIC_PHONE}</p>
        </div>
      </WidgetContainer>
    );
  }

  // Web call screen
  if (screen === "webcall") {
    return (
      <WidgetContainer>
        <Header showBack onBack={() => { endWebCall(); setScreen("welcome"); }} />
        <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ background: "linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)" }}>
          <div className="relative mb-6">
            <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-emerald-200 shadow-xl">
              <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={112} height={112} className="w-full h-full object-cover object-top" />
            </div>
            {webCallStatus === "active" && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400" style={{ animation: "pulse-ring 1.5s ease-out infinite" }} />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400" style={{ animation: "pulse-ring 1.5s ease-out infinite 0.5s" }} />
              </>
            )}
          </div>
          
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            {webCallStatus === "connecting" && t.connecting}
            {webCallStatus === "active" && t.inCall}
            {webCallStatus === "ended" && t.callEnded}
          </h3>
          
          {error && <p className="text-rose-500 text-sm mb-4">{error}</p>}
          
          {webCallStatus === "active" && (
            <button onClick={endWebCall}
              className="mt-4 px-8 py-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm transition-colors shadow-lg">
              {t.endCall}
            </button>
          )}
          
          {webCallStatus === "connecting" && (
            <div className="flex gap-2 mt-4">
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>
      </WidgetContainer>
    );
  }

  // Phone call screen
  if (screen === "call") {
    return (
      <WidgetContainer>
        <Header showBack onBack={() => { setScreen("welcome"); setCallStatus("idle"); setPhoneNumber(""); setError(null); }} />
        <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%)" }}>
          <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-violet-200 shadow-lg mb-4">
            <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={80} height={80} className="w-full h-full object-cover object-top" />
          </div>
          
          {callStatus === "idle" && (
            <>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{t.getCall}</h3>
              <p className="text-sm text-slate-500 mb-6">{lang === "fr" ? "Aliice vous rappelle!" : "Aliice will call you!"}</p>
              
              {error && <p className="text-rose-500 text-sm mb-4">{error}</p>}
              
              <div className="w-full space-y-3">
                <label className="text-sm font-medium text-slate-700">{t.phoneLabel}</label>
                <input ref={phoneInputRef} type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && requestPhoneCall()}
                  placeholder={t.phonePlaceholder}
                  className="w-full px-4 py-3 rounded-xl bg-white border-2 border-violet-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 text-center text-lg" />
                <button onClick={requestPhoneCall}
                  className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold text-sm transition-colors shadow-lg">
                  {t.requestCall}
                </button>
              </div>
            </>
          )}
          
          {callStatus === "calling" && (
            <>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{t.calling}</h3>
              <div className="flex gap-2 mt-4">
                <span className="w-3 h-3 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-3 h-3 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-3 h-3 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </>
          )}
          
          {callStatus === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-600">{t.callSuccess}</h3>
              <p className="text-sm text-slate-500 mt-2">{lang === "fr" ? "Répondez à votre téléphone!" : "Answer your phone!"}</p>
            </>
          )}
        </div>
      </WidgetContainer>
    );
  }

  // Chat screen
  return (
    <WidgetContainer>
      <Header showBack onBack={() => setScreen("welcome")} />
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ background: "#f8fafc" }}>
        {error && <div className="text-center text-xs text-rose-500 bg-rose-50 rounded-xl py-2 px-4">{error}</div>}
        {messages.length === 0 && !thinking && !error && (
          <div className="flex justify-center pt-12"><p className="text-xs text-slate-400">{t.starting}</p></div>
        )}
        {messages.map((msg) => (
          <div key={msg.id ?? msg.created_timestamp} className={`embed-msg flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "agent" && (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end mb-0.5 shadow-sm">
                <Image src="/logos/AliiceAgent.jpg" alt="" width={32} height={32} className="w-full h-full object-cover object-top" />
              </div>
            )}
            <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === "user" ? "bg-sky-500 text-white rounded-br-sm" : "bg-white text-slate-800 rounded-bl-sm border border-slate-100"
            }`}>
              {msg.role === "agent" ? linkify(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="embed-msg flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end mb-0.5 shadow-sm">
              <Image src="/logos/AliiceAgent.jpg" alt="" width={32} height={32} className="w-full h-full object-cover object-top" />
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
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={t.placeholder} disabled={!chatId || thinking}
          className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50" />
        <button onClick={sendMessage} disabled={!input.trim() || !chatId || thinking}
          className="w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow">
          <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </WidgetContainer>
  );
}
