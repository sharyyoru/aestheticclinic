"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useMessagesUnread } from "@/components/MessagesUnreadContext";

type MentionNote = {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

type MentionPatient = {
  id: string;
  first_name: string;
  last_name: string;
};

type MentionRow = {
  id: string;
  created_at: string;
  read_at: string | null;
  patient_id: string;
  note: MentionNote | null;
  patient: MentionPatient | null;
};

export default function MessagesPage() {
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { setUnreadCountOptimistic, refreshUnread } = useMessagesUnread();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [priorityMode, setPriorityMode] = useState<"crm" | "medical">("crm");

  useEffect(() => {
    let isMounted = true;

    async function loadMentions() {
      try {
        setLoading(true);
        setError(null);

        const { data: authData } = await supabaseClient.auth.getUser();
        const user = authData?.user;

        if (!user) {
          if (!isMounted) return;
          setError("You must be logged in to view messages.");
          setMentions([]);
          setLoading(false);
          return;
        }

        const meta = (user.user_metadata || {}) as Record<string, unknown>;
        const rawPriority = (meta["priority_mode"] as string) || "";
        const next: "crm" | "medical" =
          rawPriority === "medical" ? "medical" : "crm";
        setPriorityMode(next);

        const { data, error } = await supabaseClient
          .from("patient_note_mentions")
          .select(
            "id, created_at, read_at, patient_id, note:patient_notes(id, body, author_name, created_at), patient:patients(id, first_name, last_name)",
          )
          .eq("mentioned_user_id", user.id)
          .order("created_at", { ascending: false });

        if (!isMounted) return;

        if (error || !data) {
          setError(error?.message ?? "Failed to load messages.");
          setMentions([]);
          setLoading(false);
          return;
        }

        setMentions(data as unknown as MentionRow[]);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load messages.");
        setMentions([]);
        setLoading(false);
      }
    }

    loadMentions();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  async function handleMarkAllRead() {
    const unread = mentions.filter((m) => !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;

    try {
      setMarkingRead(true);
      const nowIso = new Date().toISOString();

      const { error } = await supabaseClient
        .from("patient_note_mentions")
        .update({ read_at: nowIso })
        .in("id", unread);

      if (error) {
        setMarkingRead(false);
        return;
      }

      setMentions((prev) =>
        prev.map((m) =>
          m.read_at || !unread.includes(m.id)
            ? m
            : { ...m, read_at: nowIso },
        ),
      );
      setUnreadCountOptimistic((prev) => prev - unread.length);
      setToastMessage("All messages marked as read.");
      setMarkingRead(false);
    } catch {
      setMarkingRead(false);
    }
  }

  function buildPatientHref(id: string) {
    if (priorityMode === "medical") {
      return `/patients/${id}?mode=medical`;
    }
    return `/patients/${id}`;
  }

  useEffect(() => {
    if (!toastMessage) return;

    const id = window.setTimeout(() => {
      setToastMessage(null);
    }, 3000);

    return () => {
      window.clearTimeout(id);
    };
  }, [toastMessage]);

  async function handleOpenMention(mention: MentionRow) {
    if (mention.read_at) return;

    const nowIso = new Date().toISOString();

    setMentions((prev) =>
      prev.map((m) => (m.id === mention.id ? { ...m, read_at: nowIso } : m)),
    );

    setUnreadCountOptimistic((prev) => prev - 1);

    try {
      await supabaseClient
        .from("patient_note_mentions")
        .update({ read_at: nowIso })
        .eq("id", mention.id);
    } catch {
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Messages</h1>
          <p className="text-xs text-slate-500">
            Notes where teammates mentioned you. Click through to open the patient.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshKey((prev) => prev + 1);
              refreshUnread().catch(() => {});
            }}
            disabled={loading}
            className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          {mentions.some((m) => !m.read_at) ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingRead}
              className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {markingRead ? "Marking..." : "Mark all as read"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        {loading ? (
          <p className="text-xs text-slate-500">Loading messages...</p>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : mentions.length === 0 ? (
          <p className="text-xs text-slate-500">No messages yet.</p>
        ) : (
          <div className="space-y-4 text-xs">
            {(() => {
              const unreadMentions = mentions.filter((m) => !m.read_at);
              const readMentions = mentions.filter((m) => m.read_at);

              const renderMentionRow = (mention: MentionRow) => {
                const createdDate = mention.created_at
                  ? new Date(mention.created_at)
                  : null;
                const createdLabel =
                  createdDate && !Number.isNaN(createdDate.getTime())
                    ? createdDate.toLocaleString()
                    : null;

                const note = mention.note;
                const patient = mention.patient;

                const patientName = patient
                  ? `${patient.first_name} ${patient.last_name}`
                  : "Unknown patient";

                return (
                  <Link
                    key={mention.id}
                    href={patient ? buildPatientHref(patient.id) : "#"}
                    onClick={() => handleOpenMention(mention)}
                    className="block rounded-lg bg-slate-50/80 px-3 py-2 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="pr-4">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          {createdLabel ? <span>{createdLabel}</span> : null}
                          <span>
                            Note created for:{" "}
                            <span className="font-medium text-sky-700 hover:text-sky-800">
                              {patientName}
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-800">
                          {note?.author_name ? (
                            <span className="font-medium">{note.author_name}: </span>
                          ) : null}
                          <span>{note?.body ?? "(Note unavailable)"}</span>
                        </p>
                      </div>
                      {!mention.read_at ? (
                        <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-sky-500" />
                      ) : null}
                    </div>
                  </Link>
                );
              };

              return (
                <>
                  {unreadMentions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600">Unread</p>
                      {unreadMentions.map((m) => renderMentionRow(m))}
                    </div>
                  )}
                  {readMentions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600">Read</p>
                      {readMentions.map((m) => renderMentionRow(m))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="rounded-full border border-slate-800/70 bg-slate-900/95 px-3 py-2 text-[11px] font-medium text-slate-50 shadow-[0_18px_40px_rgba(15,23,42,0.55)]">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
}
