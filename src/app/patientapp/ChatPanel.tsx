"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, Phone, PhoneOff, X, Mic } from "lucide-react";
import { RetellWebClient } from "retell-client-js-sdk";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string;
  created_timestamp: number;
}

export type ServiceContext = {
  name: string;
  category?: string;
  url?: string;
};

type ChatPanelProps = {
  /** When set, the conversation is scoped to a specific service/page. */
  serviceContext?: ServiceContext;
  /** Render a close/back control in the header (for overlay usage). */
  onClose?: () => void;
  lang?: "en" | "fr";
};

type CallStatus = "idle" | "connecting" | "active" | "ended";

// Convert URLs and phone numbers to clickable links (black & white styling)
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)|(\+[\d][\d\s\-.()]{5,20}[\d])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      parts.push(
        <a key={key++} href={m[2]} target="_blank" rel="noopener noreferrer" className="underline font-medium break-all">
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      parts.push(
        <a key={key++} href={m[3]} target="_blank" rel="noopener noreferrer" className="underline break-all">
          {m[3]}
        </a>,
      );
    } else if (m[4]) {
      parts.push(
        <a key={key++} href={`tel:${m[4].replace(/[\s\-().]/g, "")}`} className="underline font-medium">
          {m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function ChatPanel({ serviceContext, onClose, lang = "en" }: ChatPanelProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice web-call state (Retell). Mic is only requested after an explicit tap.
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const retellRef = useRef<RetellWebClient | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const primedRef = useRef(false);

  // Single string describing the page/service, injected into the agent context.
  const serviceContextString = serviceContext
    ? [
        serviceContext.name,
        serviceContext.category ? `(${serviceContext.category})` : "",
        serviceContext.url ? `— page: ${serviceContext.url}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Start a chat session on mount
  useEffect(() => {
    let cancelled = false;
    async function startChat() {
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/retell/create-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang,
            service_context: serviceContextString || undefined,
            source_url: serviceContext?.url,
          }),
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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim();
      if (!text || !chatId || thinking) return;
      if (override === undefined) setInput("");
      setThinking(true);

      const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, created_timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);

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
          : Array.isArray(data.messages)
          ? data.messages
          : [];
        const agentReplies = newMsgs.filter((m: Message) => m.role === "agent");
        if (agentReplies.length > 0) {
          setMessages((prev) => [...prev, agentReplies[agentReplies.length - 1]]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: "err-" + Date.now(), role: "agent", content: "Sorry, something went wrong. Please try again.", created_timestamp: Date.now() },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [input, chatId, thinking],
  );

  // When scoped to a service, send a contextual opening message once the chat is ready.
  useEffect(() => {
    if (!serviceContext || !chatId || primedRef.current) return;
    primedRef.current = true;
    const opener =
      lang === "fr"
        ? `J'aimerais en savoir plus sur ${serviceContext.name}.`
        : `I'd like to know more about ${serviceContext.name}.`;
    void sendMessage(opener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // ─── Voice web call ───────────────────────────────────────────────
  const endWebCall = useCallback(() => {
    if (retellRef.current) {
      try {
        retellRef.current.stopCall();
      } catch {
        /* ignore */
      }
      retellRef.current = null;
    }
    setCallStatus("idle");
  }, []);

  const startWebCall = useCallback(async () => {
    if (callStatus === "connecting" || callStatus === "active") return;
    setCallStatus("connecting");
    setCallError(null);
    try {
      const res = await fetch("/api/retell/web-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, service_context: serviceContextString || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) throw new Error(data.error ?? "Failed to start call");

      const client = new RetellWebClient();
      retellRef.current = client;
      client.on("call_started", () => setCallStatus("active"));
      client.on("call_ended", () => {
        retellRef.current = null;
        setCallStatus("ended");
        setTimeout(() => setCallStatus("idle"), 1800);
      });
      client.on("error", (e: unknown) => {
        console.error("Retell web-call error:", e);
        try {
          client.stopCall();
        } catch {
          /* ignore */
        }
        retellRef.current = null;
        setCallError(lang === "fr" ? "La connexion a échoué. Réessayez." : "Couldn't connect. Please try again.");
        setCallStatus("idle");
      });

      // Requests microphone permission only now, after the user tapped Call.
      await client.startCall({ accessToken: data.access_token });
    } catch (e: unknown) {
      setCallError((e as Error).message || (lang === "fr" ? "La connexion a échoué." : "Couldn't connect."));
      setCallStatus("idle");
    }
  }, [callStatus, lang, serviceContextString]);

  // Tear down any active call when unmounting.
  useEffect(() => {
    return () => {
      if (retellRef.current) {
        try {
          retellRef.current.stopCall();
        } catch {
          /* ignore */
        }
        retellRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex flex-col h-full bg-white">
      <style>{`
        @keyframes bwDot { 0%,60%,100% { transform:translateY(0); opacity:.4; } 30% { transform:translateY(-5px); opacity:1; } }
        @keyframes bwMsgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bwRing { 0% { transform:scale(1); opacity:.7; } 100% { transform:scale(1.7); opacity:0; } }
        .bw-msg { animation: bwMsgIn 0.22s ease-out both; }
        .bw-dot { animation: bwDot 1.3s ease-in-out infinite; }
        .bw-dot:nth-child(2) { animation-delay:.18s; }
        .bw-dot:nth-child(3) { animation-delay:.36s; }
        .bw-ring { animation: bwRing 1.5s ease-out infinite; }
        .bw-ring2 { animation: bwRing 1.5s ease-out infinite .5s; }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 flex-shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Back"
            className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-neutral-500 active:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
          <span className="text-white font-bold text-sm">A</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-black leading-none">Aliice</p>
          <p className="text-[11px] text-neutral-500 font-medium mt-1 truncate">
            {serviceContext ? `About ${serviceContext.name}` : "AI Assistant"}
          </p>
        </div>
        {/* Voice call CTA — mic is only requested after this tap */}
        <button
          onClick={startWebCall}
          disabled={callStatus !== "idle"}
          aria-label="Talk to Aliice"
          className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-black text-white text-xs font-semibold active:bg-neutral-800 disabled:opacity-40"
        >
          <Phone className="w-4 h-4" />
          Call
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-4 bg-neutral-50">
        {error && <div className="text-center text-xs text-neutral-600 bg-neutral-100 rounded-xl py-2 px-4">{error}</div>}
        {messages.length === 0 && !thinking && !error && (
          <div className="flex justify-center pt-12">
            <p className="text-xs text-neutral-400">Starting conversation…</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id ?? msg.created_timestamp} className={`bw-msg flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "agent" && (
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center flex-shrink-0 self-end mb-0.5">
                <span className="text-white font-bold text-xs">A</span>
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-black text-white rounded-br-sm"
                  : "bg-white text-black rounded-bl-sm border border-neutral-200"
              }`}
            >
              {msg.role === "agent" ? linkify(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="bw-msg flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center flex-shrink-0 self-end mb-0.5">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1.5">
              <span className="bw-dot w-2 h-2 rounded-full bg-neutral-500 block" />
              <span className="bw-dot w-2 h-2 rounded-full bg-neutral-500 block" />
              <span className="bw-dot w-2 h-2 rounded-full bg-neutral-500 block" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-neutral-200 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask a question…"
          disabled={!chatId || thinking}
          className="flex-1 bg-neutral-100 rounded-full px-4 py-3 text-base text-black placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || !chatId || thinking}
          className="w-11 h-11 rounded-full bg-black hover:bg-neutral-800 disabled:opacity-30 text-white flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Voice call overlay */}
      {callStatus !== "idle" && (
        <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-6">
            <div className="w-28 h-28 rounded-full bg-black flex items-center justify-center">
              <span className="text-white font-bold text-3xl">A</span>
            </div>
            {callStatus === "active" && (
              <>
                <span className="bw-ring absolute inset-0 rounded-full border-2 border-black" />
                <span className="bw-ring2 absolute inset-0 rounded-full border-2 border-black" />
              </>
            )}
          </div>

          <p className="text-lg font-bold text-black">
            {callStatus === "connecting" && (lang === "fr" ? "Connexion…" : "Connecting…")}
            {callStatus === "active" && (lang === "fr" ? "En appel avec Aliice" : "On a call with Aliice")}
            {callStatus === "ended" && (lang === "fr" ? "Appel terminé" : "Call ended")}
          </p>
          {serviceContext && (
            <p className="text-xs text-neutral-500 mt-1">
              {lang === "fr" ? "À propos de" : "About"} {serviceContext.name}
            </p>
          )}

          {callStatus === "connecting" && (
            <p className="text-[11px] text-neutral-400 mt-3 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              {lang === "fr" ? "Autorisez le micro" : "Please allow microphone access"}
            </p>
          )}

          {(callStatus === "connecting" || callStatus === "active") && (
            <button
              onClick={endWebCall}
              className="mt-8 px-7 py-3 rounded-full bg-red-500 text-white font-semibold text-sm flex items-center gap-2 active:bg-red-600"
            >
              <PhoneOff className="w-4 h-4" />
              {lang === "fr" ? "Raccrocher" : "End call"}
            </button>
          )}
        </div>
      )}

      {/* Call error toast */}
      {callError && callStatus === "idle" && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-neutral-900 text-white text-xs px-4 py-2 rounded-full shadow-lg">
          {callError}
        </div>
      )}
    </div>
  );
}
