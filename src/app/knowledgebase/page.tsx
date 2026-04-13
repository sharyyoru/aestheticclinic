"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";

type Topic = {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  is_pinned: boolean;
  is_archived: boolean;
  message_count: number;
  attachment_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type Attachment = {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  url?: string;
  topic_title?: string;
  topic_id?: string;
};

const TOPIC_COLORS: Record<string, { bg: string; light: string; text: string; border: string; gradient: string }> = {
  sky: { bg: "bg-sky-500", light: "bg-sky-50", text: "text-sky-600", border: "border-sky-200", gradient: "from-sky-400 to-sky-600" },
  violet: { bg: "bg-violet-500", light: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", gradient: "from-violet-400 to-violet-600" },
  rose: { bg: "bg-rose-500", light: "bg-rose-50", text: "text-rose-600", border: "border-rose-200", gradient: "from-rose-400 to-rose-600" },
  amber: { bg: "bg-amber-500", light: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", gradient: "from-amber-400 to-amber-600" },
  emerald: { bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", gradient: "from-emerald-400 to-emerald-600" },
  slate: { bg: "bg-slate-500", light: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", gradient: "from-slate-400 to-slate-600" },
};

const TOPIC_ICONS: Record<string, string> = {
  sparkles: "✨",
  brain: "🧠",
  book: "📚",
  lightbulb: "💡",
  rocket: "🚀",
  target: "🎯",
  chart: "📊",
  code: "💻",
  health: "🏥",
  science: "🔬",
};

function getTopicColor(colorName: string) {
  return TOPIC_COLORS[colorName] || TOPIC_COLORS.sky;
}

function getTopicIcon(iconName: string) {
  return TOPIC_ICONS[iconName] || "✨";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

type TabType = "topics" | "files" | "archived";

export default function KnowledgeBasePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [archivedTopics, setArchivedTopics] = useState<Topic[]>([]);
  const [allAttachments, setAllAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("topics");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "messages" | "files">("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabaseClient.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    async function loadData() {
      setLoading(true);
      try {
        // Load active topics
        const topicsRes = await fetch(`/api/prompt/topics?userId=${userId}`);
        const topicsData = await topicsRes.json();
        if (topicsData.topics) {
          setTopics(topicsData.topics.filter((t: Topic) => !t.is_archived));
          setArchivedTopics(topicsData.topics.filter((t: Topic) => t.is_archived));
        }

        // Load all attachments
        const { data: attachments } = await supabaseClient
          .from("knowledge_attachments")
          .select(`
            id,
            file_name,
            file_type,
            mime_type,
            file_size,
            storage_path,
            topic_id,
            knowledge_topics!inner (
              title,
              user_id
            )
          `)
          .order("created_at", { ascending: false });

        if (attachments) {
          type AttachmentRow = {
            id: string;
            file_name: string;
            file_type: string;
            mime_type: string;
            file_size: number;
            storage_path: string;
            topic_id: string;
            knowledge_topics: { title: string; user_id: string };
          };
          const rows = attachments as unknown as AttachmentRow[];
          const userAttachments = rows
            .filter(a => a.knowledge_topics?.user_id === userId)
            .map(a => ({
              id: a.id,
              file_name: a.file_name,
              file_type: a.file_type,
              mime_type: a.mime_type,
              file_size: a.file_size,
              storage_path: a.storage_path,
              topic_id: a.topic_id,
              topic_title: a.knowledge_topics?.title,
            }));
          setAllAttachments(userAttachments);
        }
      } catch (err) {
        console.error("Failed to load knowledge base:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  async function restoreTopic(topicId: string) {
    if (!userId) return;
    try {
      await fetch("/api/prompt/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, userId, is_archived: false }),
      });
      const topic = archivedTopics.find(t => t.id === topicId);
      if (topic) {
        setArchivedTopics(prev => prev.filter(t => t.id !== topicId));
        setTopics(prev => [{ ...topic, is_archived: false }, ...prev]);
      }
    } catch (err) {
      console.error("Failed to restore topic:", err);
    }
  }

  async function deleteTopic(topicId: string) {
    if (!userId) return;
    if (!confirm("Permanently delete this topic and all its data?")) return;
    
    try {
      await fetch(`/api/prompt/topics?topicId=${topicId}&userId=${userId}`, {
        method: "DELETE",
      });
      setArchivedTopics(prev => prev.filter(t => t.id !== topicId));
      setTopics(prev => prev.filter(t => t.id !== topicId));
    } catch (err) {
      console.error("Failed to delete topic:", err);
    }
  }

  const filteredTopics = (activeTab === "archived" ? archivedTopics : topics)
    .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "messages":
          return b.message_count - a.message_count;
        case "files":
          return b.attachment_count - a.attachment_count;
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

  const filteredAttachments = allAttachments.filter(a =>
    a.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.topic_title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalTopics: topics.length,
    totalMessages: topics.reduce((sum, t) => sum + t.message_count, 0),
    totalFiles: topics.reduce((sum, t) => sum + t.attachment_count, 0),
    pinnedTopics: topics.filter(t => t.is_pinned).length,
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
              <p className="text-slate-500">Your AI-powered knowledge repository</p>
            </div>
            <Link
              href="/prompt"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2.5 font-medium text-white shadow-lg transition hover:shadow-xl"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Topic
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                  <span className="text-xl">📂</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalTopics}</p>
                  <p className="text-xs text-slate-500">Topics</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                  <span className="text-xl">💬</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalMessages}</p>
                  <p className="text-xs text-slate-500">Messages</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <span className="text-xl">📎</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalFiles}</p>
                  <p className="text-xs text-slate-500">Files</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100">
                  <span className="text-xl">📌</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.pinnedTopics}</p>
                  <p className="text-xs text-slate-500">Pinned</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs & Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
            {[
              { id: "topics", label: "Topics", icon: "📂" },
              { id: "files", label: "Files", icon: "📎" },
              { id: "archived", label: "Archived", icon: "🗄️" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-violet-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-48 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>

            {activeTab !== "files" && (
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              >
                <option value="updated">Last Updated</option>
                <option value="created">Created</option>
                <option value="messages">Most Messages</option>
                <option value="files">Most Files</option>
              </select>
            )}

            <div className="flex rounded-lg border border-slate-200 bg-white">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-slate-100 text-violet-600" : "text-slate-400"}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-slate-100 text-violet-600" : "text-slate-400"}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === "files" ? (
          // Files View
          <div className="rounded-xl bg-white shadow-sm">
            {filteredAttachments.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-3 text-4xl">📎</div>
                <p className="text-slate-500">No files yet</p>
                <p className="mt-1 text-sm text-slate-400">Upload files in your topics to see them here</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredAttachments.map(att => (
                  <div key={att.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                        {att.mime_type?.startsWith("image/") ? (
                          <span className="text-xl">🖼️</span>
                        ) : att.mime_type === "application/pdf" ? (
                          <span className="text-xl">📄</span>
                        ) : (
                          <span className="text-xl">📎</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{att.file_name}</p>
                        <p className="text-sm text-slate-500">
                          {att.topic_title} • {formatFileSize(att.file_size)}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/prompt?topic=${att.topic_id}`}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
                    >
                      View Topic
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="rounded-xl bg-white py-16 text-center shadow-sm">
            <div className="mb-4 text-5xl">{activeTab === "archived" ? "🗄️" : "📂"}</div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              {activeTab === "archived" ? "No archived topics" : "No topics yet"}
            </h3>
            <p className="text-slate-500">
              {activeTab === "archived"
                ? "Archived topics will appear here"
                : "Create a topic to start building your knowledge base"}
            </p>
            {activeTab !== "archived" && (
              <Link
                href="/prompt"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 font-medium text-white"
              >
                Create First Topic
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTopics.map(topic => {
              const color = getTopicColor(topic.color);
              const icon = getTopicIcon(topic.icon);
              
              return (
                <div
                  key={topic.id}
                  className="group relative overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-lg"
                >
                  <div className={`h-2 bg-gradient-to-r ${color.gradient}`} />
                  <div className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color.light}`}>
                        <span className="text-2xl">{icon}</span>
                      </div>
                      {topic.is_pinned && <span className="text-amber-500">📌</span>}
                    </div>
                    <h3 className="mb-1 font-semibold text-slate-900 line-clamp-1">{topic.title}</h3>
                    <p className="mb-4 text-sm text-slate-500">
                      {topic.message_count} messages • {topic.attachment_count} files
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {topic.last_message_at ? formatDate(topic.last_message_at) : formatDate(topic.created_at)}
                      </span>
                      <div className="flex gap-2">
                        {activeTab === "archived" ? (
                          <>
                            <button
                              onClick={() => restoreTopic(topic.id)}
                              className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => deleteTopic(topic.id)}
                              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <Link
                            href={`/prompt?topic=${topic.id}`}
                            className={`rounded-lg ${color.light} px-3 py-1.5 text-xs font-medium ${color.text} hover:opacity-80`}
                          >
                            Open
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // List View
          <div className="rounded-xl bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {filteredTopics.map(topic => {
                const color = getTopicColor(topic.color);
                const icon = getTopicIcon(topic.icon);
                
                return (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color.light}`}>
                        <span className="text-xl">{icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900">{topic.title}</h3>
                          {topic.is_pinned && <span className="text-amber-500">📌</span>}
                        </div>
                        <p className="text-sm text-slate-500">
                          {topic.message_count} messages • {topic.attachment_count} files • {formatDate(topic.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {activeTab === "archived" ? (
                        <>
                          <button
                            onClick={() => restoreTopic(topic.id)}
                            className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-100"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => deleteTopic(topic.id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <Link
                          href={`/prompt?topic=${topic.id}`}
                          className={`rounded-lg ${color.bg} px-4 py-2 text-sm font-medium text-white hover:opacity-90`}
                        >
                          Open Topic
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
