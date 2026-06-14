"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string;
  created_timestamp: number;
}

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

export default function ChatPanel() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
          body: JSON.stringify({ lang: "en" }),
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
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !chatId || thinking) return;
    setInput("");
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
  }, [input, chatId, thinking]);

  return (
    <div className="flex flex-col h-full bg-white">
      <style>{`
        @keyframes bwDot { 0%,60%,100% { transform:translateY(0); opacity:.4; } 30% { transform:translateY(-5px); opacity:1; } }
        @keyframes bwMsgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .bw-msg { animation: bwMsgIn 0.22s ease-out both; }
        .bw-dot { animation: bwDot 1.3s ease-in-out infinite; }
        .bw-dot:nth-child(2) { animation-delay:.18s; }
        .bw-dot:nth-child(3) { animation-delay:.36s; }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-neutral-200 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
          <span className="text-white font-bold text-sm">A</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-black leading-none">Aliice</p>
          <p className="text-[11px] text-neutral-500 font-medium mt-1">AI Assistant</p>
        </div>
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
          onClick={sendMessage}
          disabled={!input.trim() || !chatId || thinking}
          className="w-11 h-11 rounded-full bg-black hover:bg-neutral-800 disabled:opacity-30 text-white flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
