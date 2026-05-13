"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string;
  created_timestamp: number;
}

const T = {
  en: {
    placeholder: "Type your message…",
    thinking: "Aliice is typing…",
    error: "Something went wrong. Please try again.",
    powered: "Powered by Aliice AI",
  },
  fr: {
    placeholder: "Tapez votre message…",
    thinking: "Aliice écrit…",
    error: "Une erreur s'est produite. Veuillez réessayer.",
    powered: "Propulsé par Aliice AI",
  },
};

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
      <div className="fixed bottom-5 right-5 z-50">
        <style>{`
          @keyframes bounceIn {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          .chat-bubble { animation: bounceIn 0.4s ease-out; }
          .chat-bubble:hover { transform: scale(1.05); }
        `}</style>
        <button
          onClick={() => setMinimized(false)}
          className="chat-bubble w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 shadow-2xl flex items-center justify-center transition-transform cursor-pointer"
          style={{ boxShadow: "0 8px 32px rgba(14,165,233,0.4)" }}
        >
          <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={56} height={56} className="rounded-full border-2 border-white" />
        </button>
      </div>
    );
  }

  // Open chat widget
  return (
    <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-40px)] h-[600px] max-h-[calc(100vh-100px)] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chat-window { animation: slideUp 0.3s ease-out; }
      `}</style>

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
          <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={40} height={40} className="object-cover" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm">Aliice</h3>
          <p className="text-sky-100 text-xs">Aesthetics Clinic Assistant</p>
        </div>
        {/* Language toggle */}
        <button
          onClick={() => setLang(l => l === "en" ? "fr" : "en")}
          className="text-[10px] font-bold text-white/80 hover:text-white px-2 py-1 rounded border border-white/30 hover:border-white/50 transition-all"
        >
          {lang === "en" ? "FR" : "EN"}
        </button>
        {/* Minimize */}
        <button onClick={() => setMinimized(true)} className="text-white/70 hover:text-white transition-colors p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
        {error && (
          <div className="text-center text-rose-500 text-sm py-2 bg-rose-50 rounded-lg">{error}</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-br-md"
                : "bg-white text-slate-700 shadow-sm border border-slate-100 rounded-bl-md"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-500 text-sm px-4 py-2.5 rounded-2xl rounded-bl-md shadow-sm border border-slate-100 flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="text-xs text-slate-400">{t.thinking}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 py-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={t.placeholder}
          disabled={!chatId || thinking}
          className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !chatId || thinking}
          className="w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 text-center">{t.powered}</p>
      </div>
    </div>
  );
}
