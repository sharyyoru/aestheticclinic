"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Menu,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import CollapseSidebarOnMount from "@/components/CollapseSidebarOnMount";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatConversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  patient_id?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
};

type ChatPatientSuggestion = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

function formatPatientForDisplay(
  patient: ChatPatientSuggestion | null | undefined,
): string {
  if (!patient) return "";
  const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
  const email = (patient.email ?? "").trim();
  const phone = (patient.phone ?? "").trim();

  if (name && (email || phone)) {
    return `${name} (${email || phone})`;
  }
  if (name) return name;
  if (email) return email;
  if (phone) return phone;
  return "Unnamed patient";
}

function generateConversationTitleFromContent(source: string): string {
  const normalized = source.trim().replace(/\s+/g, " ");
  if (!normalized) return "New chat";
  const maxLength = 60;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function isPlaceholderTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const trimmed = title.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed === "new chat") return true;
  if (trimmed === "untitled chat") return true;
  return false;
}

function formatConversationTitle(conversation: ChatConversation): string {
  const raw = (conversation.title || "").trim();
  if (!raw) return "Untitled chat";
  if (raw.length <= 60) return raw;
  return `${raw.slice(0, 60)}…`;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[1];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={parts.length} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={parts.length} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={parts.length}
          className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-slate-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(token);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let listItems: string[] | null = null;
  let keyIndex = 0;

  const flushList = () => {
    if (listItems && listItems.length > 0) {
      elements.push(
        <ul
          key={`ul-${keyIndex++}`}
          className="my-2 list-disc space-y-1 pl-4"
        >
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      listItems = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushList();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre
          key={`pre-${keyIndex++}`}
          className="my-2 overflow-x-auto rounded-lg bg-slate-100 p-2 text-[12px] dark:bg-slate-800"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!listItems) listItems = [];
      listItems.push(line.slice(2));
      i++;
      continue;
    }
    flushList();
    if (line.trim() === "") {
      elements.push(<br key={`br-${keyIndex++}`} />);
    } else {
      elements.push(
        <p key={`p-${keyIndex++}`} className="mb-2 last:mb-0">
          {renderInline(line)}
        </p>,
      );
    }
    i++;
  }
  flushList();
  return <>{elements}</>;
}

const SUGGESTIONS = [
  {
    label: "Draft a post-op document",
    prompt:
      "Draft a post-operative care document for my patient with clear instructions.",
  },
  {
    label: "Book an appointment",
    prompt:
      "Help me find the next available appointment slot for a consultation.",
  },
  {
    label: "Write a patient email",
    prompt:
      "Write a professional and reassuring email to a patient about their upcoming appointment.",
  },
  {
    label: "Explain an invoice",
    prompt:
      "Explain this invoice to a patient in simple, friendly language.",
  },
];

export default function ChatWithAliicePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );
  const [initialMessagesLoading, setInitialMessagesLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [patientOptions, setPatientOptions] = useState<ChatPatientSuggestion[]>([]);
  const [patientOptionsLoading, setPatientOptionsLoading] = useState(false);
  const [patientOptionsError, setPatientOptionsError] = useState<string | null>(
    null,
  );
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const selectedPatient =
    selectedPatientId && patientOptions.length > 0
      ? patientOptions.find((patient) => patient.id === selectedPatientId) ?? null
      : null;

  const filteredPatientOptions = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return patientOptions;

    return patientOptions.filter((patient) => {
      const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`
        .trim()
        .toLowerCase();
      const email = (patient.email ?? "").toLowerCase();
      const phone = (patient.phone ?? "").toLowerCase();

      if (name.includes(term)) return true;
      if (email.includes(term)) return true;
      if (phone.includes(term)) return true;

      return false;
    });
  }, [patientSearch, patientOptions]);

  useEffect(() => {
    let isMounted = true;

    async function loadUserAndConversations() {
      try {
        setConversationsLoading(true);
        setConversationsError(null);

        const { data, error: authError } = await supabaseClient.auth.getUser();

        if (!isMounted) return;

        if (authError || !data?.user) {
          setCurrentUserId(null);
          setConversations([]);
          setConversationsLoading(false);
          return;
        }

        const authUser = data.user;
        setCurrentUserId(authUser.id);
        const displayName =
          (authUser.user_metadata?.full_name as string | undefined) ||
          (authUser.user_metadata?.first_name as string | undefined) ||
          (authUser.email ? authUser.email.split("@")[0] : null);
        setUserName(displayName ?? null);

        const { data: rows, error } = await supabaseClient
          .from("chat_conversations")
          .select(
            "id, title, created_at, updated_at, is_archived, archived_at, patient_id",
          )
          .eq("user_id", authUser.id)
          .eq("is_archived", false)
          .order("updated_at", { ascending: false });

        if (!isMounted) return;

        if (error || !rows) {
          setConversations([]);
          setConversationsError(error?.message ?? "Failed to load conversations.");
        } else {
          const items = (rows as any[]).map((row) => ({
            id: row.id as string,
            title: (row.title as string | null) ?? null,
            created_at: row.created_at as string,
            updated_at: row.updated_at as string,
            is_archived: (row.is_archived as boolean | null) ?? false,
            archived_at: (row.archived_at as string | null) ?? null,
            patient_id: (row.patient_id as string | null) ?? null,
          }));
          setConversations(items);
          if (items.length > 0) {
            setActiveConversationId(items[0].id);
          }
        }

        setConversationsLoading(false);
      } catch {
        if (!isMounted) return;
        setConversations([]);
        setConversationsError("Failed to load conversations.");
        setConversationsLoading(false);
      }
    }

    void loadUserAndConversations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPatients() {
      try {
        setPatientOptionsLoading(true);
        setPatientOptionsError(null);

        const { data, error } = await supabaseClient
          .from("patients")
          .select("id, first_name, last_name, email, phone")
          .order("created_at", { ascending: false })
          .limit(500);

        if (!isMounted) return;

        if (error || !data) {
          setPatientOptions([]);
          setPatientOptionsError(error?.message ?? "Failed to load patients.");
        } else {
          setPatientOptions(data as ChatPatientSuggestion[]);
        }

        setPatientOptionsLoading(false);
      } catch {
        if (!isMounted) return;
        setPatientOptions([]);
        setPatientOptionsError("Failed to load patients.");
        setPatientOptionsLoading(false);
      }
    }

    void loadPatients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setEditingTitle("");
      return;
    }

    const current = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    if (!current) {
      setEditingTitle("");
      return;
    }

    setEditingTitle(current.title ?? "");
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setSelectedPatientId(null);
      return;
    }

    const current = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    setSelectedPatientId((current?.patient_id as string | null) ?? null);
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    async function loadMessages() {
      try {
        setInitialMessagesLoading(true);

        const { data, error } = await supabaseClient
          .from("chat_messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: true });

        if (!isMounted) return;

        if (error || !data) {
          setMessages([]);
        } else {
          const rows = data as any[];
          const mapped: ChatMessage[] = rows.map((row) => {
            const roleValue = row.role as "user" | "assistant" | "system";
            const safeRole: "user" | "assistant" =
              roleValue === "user" ? "user" : "assistant";
            return {
              id: row.id as string,
              role: safeRole,
              content: (row.content as string) ?? "",
            };
          });
          setMessages(
            mapped.filter((message) => message.content.trim().length > 0),
          );
        }

        setInitialMessagesLoading(false);
      } catch {
        if (!isMounted) return;
        setMessages([]);
        setInitialMessagesLoading(false);
      }
    }

    void loadMessages();

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  async function ensureConversation(
    firstMessageContent: string,
  ): Promise<string | null> {
    if (activeConversationId) {
      return activeConversationId;
    }
    if (!currentUserId) {
      return null;
    }

    const title = generateConversationTitleFromContent(firstMessageContent);

    const { data, error } = await supabaseClient
      .from("chat_conversations")
      .insert({
        user_id: currentUserId,
        title,
      })
      .select(
        "id, title, created_at, updated_at, is_archived, archived_at, patient_id",
      )
      .single();

    if (error || !data) {
      setError(error?.message ?? "Failed to create conversation.");
      return null;
    }

    const row = data as any;
    const conversationId = row.id as string;

    const conversation: ChatConversation = {
      id: conversationId,
      title: (row.title as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      is_archived: (row.is_archived as boolean | null) ?? false,
      archived_at: (row.archived_at as string | null) ?? null,
      patient_id: (row.patient_id as string | null) ?? null,
    };

    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversationId);

    return conversationId;
  }

  async function handleStartNewConversation() {
    if (!currentUserId || loading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabaseClient
        .from("chat_conversations")
        .insert({
          user_id: currentUserId,
          title: "New chat",
        })
        .select(
          "id, title, created_at, updated_at, is_archived, archived_at, patient_id",
        )
        .single();

      if (error || !data) {
        setError(error?.message ?? "Failed to create conversation.");
        setLoading(false);
        return;
      }

      const row = data as any;

      const conversation: ChatConversation = {
        id: row.id as string,
        title: (row.title as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        is_archived: (row.is_archived as boolean | null) ?? false,
        archived_at: (row.archived_at as string | null) ?? null,
        patient_id: (row.patient_id as string | null) ?? null,
      };

      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      setMessages([]);
      setLoading(false);
    } catch {
      setError("Failed to create conversation.");
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    let conversationId = activeConversationId;

    if (!conversationId && currentUserId) {
      conversationId = await ensureConversation(trimmed);
      if (!conversationId) {
        setLoading(false);
        return;
      }
    }

    if (conversationId) {
      try {
        const { error: insertError } = await supabaseClient
          .from("chat_messages")
          .insert({
            conversation_id: conversationId,
            role: "user",
            content: trimmed,
          });

        if (insertError) {
          console.error("Failed to save user message", insertError);
        }
      } catch (saveError) {
        console.error("Failed to save user message", saveError);
      }
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          patientId: selectedPatientId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Failed to get a response from Aliice.");
        setLoading(false);
        return;
      }

      const json = (await response.json()) as {
        message?: { role?: string; content?: string };
      };

      if (!json.message || !json.message.content) {
        setError("Aliice did not return a response.");
        setLoading(false);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: json.message.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (conversationId) {
        try {
          const nowIso = new Date().toISOString();

          const { error: insertError } = await supabaseClient
            .from("chat_messages")
            .insert({
              conversation_id: conversationId,
              role: "assistant",
              content: assistantMessage.content,
            });

          if (insertError) {
            console.error("Failed to save assistant message", insertError);
          }

          let shouldUpdateTitle = false;

          setConversations((prev) => {
            const items = prev.filter((item) => item.id !== conversationId);
            const existing = prev.find((item) => item.id === conversationId);
            const base: ChatConversation =
              existing ??
              {
                id: conversationId,
                title: null,
                created_at: nowIso,
                updated_at: nowIso,
              };

            shouldUpdateTitle = isPlaceholderTitle(base.title);

            const nextTitle = shouldUpdateTitle
              ? generateConversationTitleFromContent(userMessage.content)
              : base.title ?? generateConversationTitleFromContent(userMessage.content);

            const updated: ChatConversation = {
              ...base,
              title: nextTitle,
              updated_at: nowIso,
            };

            return [updated, ...items];
          });

          const updates: { updated_at: string; title?: string } = {
            updated_at: nowIso,
          };

          if (shouldUpdateTitle) {
            updates.title = generateConversationTitleFromContent(
              userMessage.content,
            );
          }

          const { error: updateError } = await supabaseClient
            .from("chat_conversations")
            .update(updates)
            .eq("id", conversationId);

          if (updateError) {
            console.error("Failed to update conversation", updateError);
          }
        } catch (saveError) {
          console.error("Failed to save assistant message", saveError);
        }
      }

      setLoading(false);
    } catch {
      setError("Network error talking to Aliice.");
      setLoading(false);
    }
  }

  async function handleTitleSave() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    const trimmed = editingTitle.trim();
    const nextTitle = trimmed
      ? trimmed.slice(0, 120)
      : null;

    // Optimistically update local state so the UI feels instant
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              title: nextTitle,
            }
          : conversation,
      ),
    );

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          title: nextTitle,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to rename conversation.");
      }
    } catch {
      setError("Failed to rename conversation.");
    }
  }

  async function handleArchiveActiveConversation() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    const nowIso = new Date().toISOString();

    // Optimistically remove the conversation and pick the next one
    let nextActiveId: string | null = null;
    setConversations((prev) => {
      const remaining = prev.filter(
        (conversation) => conversation.id !== activeConversationId,
      );
      const next = remaining[0] ?? null;
      nextActiveId = next ? next.id : null;
      return remaining;
    });

    setActiveConversationId(nextActiveId);
    if (!nextActiveId) {
      setMessages([]);
      setEditingTitle("");
    }

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          is_archived: true,
          archived_at: nowIso,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to archive conversation.");
      }
    } catch {
      setError("Failed to archive conversation.");
    }
  }

  async function handleDeleteActiveConversation() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    // Optimistically remove from local state
    setConversations((prev) =>
      prev.filter((conversation) => conversation.id !== activeConversationId),
    );
    setActiveConversationId(null);
    setMessages([]);
    setEditingTitle("");

    try {
      const { error: deleteError } = await supabaseClient
        .from("chat_conversations")
        .delete()
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (deleteError) {
        setError(deleteError.message ?? "Failed to delete conversation.");
      }
    } catch {
      setError("Failed to delete conversation.");
    }
  }

  async function handleSelectPatient(patient: ChatPatientSuggestion) {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    const newPatientId = patient.id as string;

    setSelectedPatientId(newPatientId);
    setPatientSearch("");

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              patient_id: newPatientId,
            }
          : conversation,
      ),
    );

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          patient_id: newPatientId,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to update patient for conversation.");
      }
    } catch {
      setError("Failed to update patient for conversation.");
    }
  }

  async function handleClearPatient() {
    if (!activeConversationId || !currentUserId) {
      return;
    }

    setSelectedPatientId(null);
    setPatientSearch("");

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              patient_id: null,
            }
          : conversation,
      ),
    );

    try {
      const { error: updateError } = await supabaseClient
        .from("chat_conversations")
        .update({
          patient_id: null,
        })
        .eq("id", activeConversationId)
        .eq("user_id", currentUserId);

      if (updateError) {
        setError(updateError.message ?? "Failed to clear patient for conversation.");
      }
    } catch {
      setError("Failed to clear patient for conversation.");
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CollapseSidebarOnMount />

      {/* Slim header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-100/80 px-3 py-2.5 dark:border-slate-700/30 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Toggle conversations"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-white">
              <Sparkles size={14} />
            </div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
              Chat with Aliice
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Patient search */}
          <div className="relative hidden max-w-[220px] sm:block">
            <input
              type="text"
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              disabled={!activeConversationId || !currentUserId}
              placeholder="Link patient..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[11px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <User
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            {patientOptionsLoading ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-500 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                Loading patients...
              </div>
            ) : null}
            {!patientOptionsLoading && patientSearch.trim().length > 0 ? (
              <div className="absolute right-0 top-full z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-[11px] shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {filteredPatientOptions.length === 0 ? (
                  <div className="px-3 py-1.5 text-slate-500">
                    No matching patients.
                  </div>
                ) : (
                  filteredPatientOptions.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                      className="flex w-full flex-col items-start px-3 py-1.5 text-left text-slate-900 hover:bg-sky-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                    >
                      <span className="font-medium">
                        {formatPatientForDisplay(patient)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
            {patientOptionsError ? (
              <p className="absolute right-0 top-full mt-1 text-[10px] text-red-600">
                {patientOptionsError}
              </p>
            ) : null}
          </div>
          {selectedPatient ? (
            <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:flex">
              <User size={12} />
              <span className="max-w-[120px] truncate">
                {formatPatientForDisplay(selectedPatient)}
              </span>
              <button
                type="button"
                onClick={handleClearPatient}
                className="ml-1 rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X size={12} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleStartNewConversation}
            disabled={loading || !currentUserId}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:px-3"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Conversation sidebar */}
        <aside
          className={
            "inset-y-0 left-0 z-20 transform border-r border-slate-100 bg-white/95 shadow-lg backdrop-blur transition-all duration-200 ease-out dark:border-slate-700/30 dark:bg-slate-900/95 " +
            (sidebarOpen
              ? "absolute w-72 translate-x-0 p-3 sm:static sm:w-64 sm:shadow-none"
              : "absolute w-72 -translate-x-full p-3 sm:static sm:w-0 sm:translate-x-0 sm:border-r-0 sm:p-0 sm:shadow-none sm:overflow-hidden")
          }
        >
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Conversations
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100 sm:hidden dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen((prev) => !prev)}
                  className="hidden rounded-full p-1 text-slate-500 hover:bg-slate-100 sm:inline-flex dark:hover:bg-slate-800"
                  aria-label="Collapse sidebar"
                >
                  <Menu size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-1 py-1">
              {conversationsLoading ? (
                <p className="px-2 text-[12px] text-slate-400">Loading...</p>
              ) : conversations.length === 0 ? (
                <p className="px-2 text-[12px] text-slate-400">
                  No conversations yet.
                </p>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => {
                        setActiveConversationId(conversation.id);
                        setSidebarOpen(false);
                      }}
                      className={
                        "group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12px] " +
                        (isActive
                          ? "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
                      }
                    >
                      <span className="line-clamp-2">
                        {formatConversationTitle(conversation)}
                      </span>
                      {isActive ? (
                        <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleArchiveActiveConversation();
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                            title="Archive"
                          >
                            <Archive size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteActiveConversation();
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-10 bg-black/20 sm:hidden"
            aria-label="Close sidebar"
          />
        ) : null}

        {/* Main chat area */}
        <main className="flex min-w-0 flex-1 flex-col bg-white/50 dark:bg-slate-900/30">
          {/* Title bar */}
          <div className="flex flex-shrink-0 items-center border-b border-slate-100 px-4 py-2 dark:border-slate-700/30">
            <input
              type="text"
              value={editingTitle}
              onChange={(event) => setEditingTitle(event.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleTitleSave();
                }
              }}
              placeholder="Name this conversation..."
              className="w-full max-w-md rounded-lg border-0 bg-transparent px-2 py-1 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:bg-slate-50 focus:ring-1 focus:ring-sky-500 dark:text-slate-100 dark:focus:bg-slate-800"
            />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8">
            {initialMessagesLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-[12px] text-slate-500">Loading conversation...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-center text-center">
                <div className="mb-6 sm:mb-8">
                  <h2 className="bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500 bg-clip-text text-3xl font-semibold text-transparent sm:text-5xl">
                    Hello{userName ? `, ${userName}` : ""}
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Ask Aliice about bookings, post-op documents, patient emails,
                    or insurance communication.
                  </p>
                </div>
                <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => setInput(suggestion.prompt)}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-sky-500/50"
                    >
                      <div className="mb-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {suggestion.label}
                      </div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400">
                        {suggestion.prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-20">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      "flex items-start gap-2 sm:gap-3 " +
                      (message.role === "user" ? "justify-end" : "justify-start")
                    }
                  >
                    {message.role === "assistant" ? (
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 sm:h-7 sm:w-7 dark:bg-slate-800">
                        <Sparkles
                          size={12}
                          className="text-sky-600 dark:text-sky-400"
                        />
                      </div>
                    ) : null}
                    <div
                      className={
                        "max-w-[88%] text-[13px] leading-relaxed sm:max-w-[75%] " +
                        (message.role === "user"
                          ? "rounded-2xl rounded-tr-sm bg-slate-100 px-3 py-1.5 text-slate-900 dark:bg-slate-800 dark:text-slate-100 sm:px-4 sm:py-2"
                          : "rounded-2xl rounded-tl-sm px-3 py-1.5 text-slate-800 dark:text-slate-200 sm:px-4 sm:py-2")
                      }
                    >
                      {message.role === "user" ? (
                        message.content
                      ) : (
                        <MarkdownContent content={message.content} />
                      )}
                    </div>
                  </div>
                ))}
                {loading ? (
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 sm:h-7 sm:w-7 dark:bg-slate-800">
                      <Sparkles
                        size={12}
                        className="text-sky-600 dark:text-sky-400"
                      />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-50 px-3 py-1.5 text-[12px] text-slate-500 dark:bg-slate-800/40 dark:text-slate-400 sm:px-4 sm:py-2">
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Floating input */}
          <div className="flex flex-shrink-0 flex-col border-t border-slate-100 bg-white/80 px-3 py-3 backdrop-blur dark:border-slate-700/30 dark:bg-slate-900/80 sm:px-4 sm:py-4">
            <form
              onSubmit={handleSubmit}
              className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-sky-400 focus-within:ring-1 focus-within:ring-sky-400 dark:border-slate-700 dark:bg-slate-800"
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={1}
                placeholder="Ask Aliice a question..."
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-l-xl bg-transparent px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (input.trim() && !loading && !initialMessagesLoading) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || initialMessagesLoading}
                className="mb-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <MoreHorizontal size={18} /> : <Send size={18} />}
              </button>
            </form>
            {(error || conversationsError) && (
              <div className="mx-auto mt-2 w-full max-w-3xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
                {error || conversationsError}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
