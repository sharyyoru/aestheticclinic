"use client";

import { useState, useEffect, useCallback } from "react";

const TABS = [
  { id: "external-labs", label: "External Labs" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ExternalLab {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  type: string;
}

const LAB_TYPE_OPTIONS = [
  { value: "medisupport_fr", label: "Medisupport (fr)" },
] as const;

const EMPTY_LAB: Omit<ExternalLab, "id"> = {
  name: "",
  url: "",
  username: "",
  password: "",
  type: "medisupport_fr",
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("external-labs");

  return (
    <div className="w-full px-2 py-6">
      <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage your account settings and integrations.
      </p>

      {/* Tab navigation */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Settings tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-sky-500 text-sky-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "external-labs" && <ExternalLabsTab />}
      </div>
    </div>
  );
}

function ExternalLabsTab() {
  const [labs, setLabs] = useState<ExternalLab[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ExternalLab, "id">>(EMPTY_LAB);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Omit<ExternalLab, "id">, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedLab = labs.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    async function fetchLabs() {
      try {
        const res = await fetch("/api/settings/external-labs");
        if (res.ok) {
          const data = await res.json();
          setLabs(data.labs || []);
        }
      } catch (err) {
        console.error("Failed to load external labs:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLabs();
  }, []);

  const persistLabs = useCallback(async (updatedLabs: ExternalLab[]) => {
    try {
      await fetch("/api/settings/external-labs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labs: updatedLabs }),
      });
    } catch (err) {
      console.error("Failed to persist external labs:", err);
    }
  }, []);

  function handleAdd() {
    const id = crypto.randomUUID();
    const newLab: ExternalLab = { id, ...EMPTY_LAB };
    const updated = [...labs, newLab];
    setLabs(updated);
    setSelectedId(id);
    setForm(EMPTY_LAB);
    setErrors({});
  }

  function handleSelect(lab: ExternalLab) {
    setSelectedId(lab.id);
    setForm({ name: lab.name, url: lab.url, username: lab.username, password: lab.password, type: lab.type || "medisupport_fr" });
    setErrors({});
    setMenuOpenId(null);
  }

  async function handleSave() {
    if (!selectedId) return;

    const newErrors: Partial<Record<keyof Omit<ExternalLab, "id">, string>> = {};
    if (!form.name.trim()) newErrors.name = "Name is required.";
    if (!form.url.trim()) newErrors.url = "URL is required.";
    if (!form.username.trim()) newErrors.username = "User name is required.";
    if (!form.password.trim()) newErrors.password = "Password is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    const updated = labs.map((l) => (l.id === selectedId ? { ...l, ...form } : l));
    setLabs(updated);
    await persistLabs(updated);
    setSaving(false);
  }

  function handleCancel() {
    if (!selectedLab) return;
    setErrors({});
    setForm({
      name: selectedLab.name,
      url: selectedLab.url,
      username: selectedLab.username,
      password: selectedLab.password,
      type: selectedLab.type || "medisupport_fr",
    });
  }

  async function handleDelete(id: string) {
    const updated = labs.filter((l) => l.id !== id);
    setLabs(updated);
    if (selectedId === id) {
      setSelectedId(null);
      setForm(EMPTY_LAB);
    }
    setMenuOpenId(null);
    await persistLabs(updated);
  }

  return (
    <div className="flex gap-6 min-h-[420px]">
      {/* Left panel – lab list */}
      <div className="w-80 shrink-0 rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            External Laboratories
          </h2>
          <button
            type="button"
            onClick={handleAdd}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-sky-500 hover:bg-sky-50 transition-colors"
            title="Add laboratory"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Column header */}
        <div className="border-b border-slate-100 px-4 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Name</span>
        </div>

        {/* Lab list */}
        <div className="max-h-[340px] overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              Loading…
            </div>
          )}
          {!loading && labs.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              No laboratories added yet.
            </div>
          )}
          {labs.map((lab) => (
            <div
              key={lab.id}
              className={`group relative flex items-center justify-between border-b border-slate-100/60 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                selectedId === lab.id
                  ? "bg-sky-50/60 text-sky-700"
                  : "text-slate-700 hover:bg-slate-50/80"
              }`}
              onClick={() => handleSelect(lab)}
            >
              <span className="truncate text-sm">
                {lab.name || "Untitled"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
        {!selectedId ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Select a laboratory or add a new one to configure.
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200/80 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-800">
                Configure the External Laboratory Settings
              </h2>
            </div>

            <div className="flex-1 px-6 py-5 space-y-5">
              {/* External Laboratory (name display) */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  External Laboratory
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700">
                  {form.name || "Untitled"}
                </div>
              </div>

              {/* Type dropdown */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30"
                >
                  {LAB_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Name + URL row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((prev) => ({ ...prev, name: undefined })); }}
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition-colors ${errors.name ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30" : "border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30"}`}
                    placeholder="Laboratory name"
                  />
                  {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    URL
                  </label>
                  <input
                    type="text"
                    value={form.url}
                    onChange={(e) => { setForm((f) => ({ ...f, url: e.target.value })); setErrors((prev) => ({ ...prev, url: undefined })); }}
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition-colors ${errors.url ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30" : "border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30"}`}
                    placeholder="https://"
                  />
                  {errors.url && <p className="mt-1 text-[11px] text-red-500">{errors.url}</p>}
                </div>
              </div>

              {/* Username + Password row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    User Name
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => { setForm((f) => ({ ...f, username: e.target.value })); setErrors((prev) => ({ ...prev, username: undefined })); }}
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition-colors ${errors.username ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30" : "border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30"}`}
                    placeholder="Username"
                  />
                  {errors.username && <p className="mt-1 text-[11px] text-red-500">{errors.username}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Password
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setErrors((prev) => ({ ...prev, password: undefined })); }}
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition-colors ${errors.password ? "border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30" : "border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30"}`}
                    placeholder="••••••••"
                  />
                  {errors.password && <p className="mt-1 text-[11px] text-red-500">{errors.password}</p>}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 px-6 py-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => selectedId && handleDelete(selectedId)}
                className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-600 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
