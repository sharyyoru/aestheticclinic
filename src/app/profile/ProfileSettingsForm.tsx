"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";

interface ProfileState {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  signatureHtml: string;
  priorityMode: "crm" | "medical";
}

export default function ProfileSettingsForm() {
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data } = await supabaseClient.auth.getUser();
      const user = data.user;
      if (!isMounted) return;
      if (!user) {
        setProfile(null);
        return;
      }

      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const firstName = (meta["first_name"] as string) || "";
      const lastName = (meta["last_name"] as string) || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ") ||
        (user.email ?? "");

      const rawPriority = (meta["priority_mode"] as string) || "";
      const priorityMode: "crm" | "medical" =
        rawPriority === "medical" ? "medical" : "crm";

      setProfile({
        firstName,
        lastName,
        fullName,
        email: user.email ?? "",
        avatarUrl: (meta["avatar_url"] as string) || null,
        signatureHtml: (meta["signature_html"] as string) || "",
        priorityMode,
      });
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!profile) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      setAvatarUploading(true);
      setAvatarError(null);
      setAvatarSuccess(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        setError("You must be logged in to update your profile.");
        return;
      }

      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        setAvatarError(
          uploadError.message ||
            "Failed to upload avatar. Ensure an 'avatars' bucket exists in Supabase Storage."
        );
        return;
      }

      const {
        data: { publicUrl },
      } = supabaseClient.storage.from("avatars").getPublicUrl(path);

      const { error: updateError } = await supabaseClient.auth.updateUser({
        data: {
          avatar_url: publicUrl,
        },
      });

      if (updateError) {
        setAvatarError(updateError.message);
        return;
      }

      setProfile({ ...profile, avatarUrl: publicUrl });
      setAvatarSuccess("Profile photo updated.");
    } catch (err) {
      setAvatarError("Unexpected error uploading avatar.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    try {
      setNameSaving(true);
      setNameError(null);
      setNameSuccess(null);

      const { error: updateError } = await supabaseClient.auth.updateUser({
        data: {
          first_name: profile.firstName.trim(),
          last_name: profile.lastName.trim(),
        },
      });

      if (updateError) {
        setNameError(updateError.message);
        setNameSaving(false);
        return;
      }

      const newFullName = [profile.firstName.trim(), profile.lastName.trim()]
        .filter(Boolean)
        .join(" ") || profile.email;

      setProfile({ ...profile, fullName: newFullName });
      setNameSuccess("Name updated successfully.");
    } catch (err) {
      setNameError("Unexpected error saving name.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handleSignatureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabaseClient.auth.updateUser({
        data: {
          signature_html: profile.signatureHtml,
        },
      });

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setProfile({ ...profile, signatureHtml: profile.signatureHtml });
      setSuccess("Settings saved.");
    } catch (err) {
      setError("Unexpected error saving signature.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePriorityChange(nextMode: "crm" | "medical") {
    if (!profile) return;

    setProfile((prev) => (prev ? { ...prev, priorityMode: nextMode } : prev));

    try {
      setSaving(true);
      setError(null);

      const { error: updateError } = await supabaseClient.auth.updateUser({
        data: {
          priority_mode: nextMode,
        },
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } catch {
      setError("Unexpected error saving priority.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs text-slate-500 shadow-sm">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="text-sm font-medium text-slate-900">Profile photo</h2>
        <p className="mt-1 text-xs text-slate-500">
          Upload an optional profile photo used in parts of the app.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.fullName || "Avatar"}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{profile.fullName.charAt(0) || "U"}</span>
            )}
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <label
              className={`inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50 ${
                avatarUploading ? "cursor-not-allowed opacity-60 hover:bg-white" : "cursor-pointer"
              }`}
            >
              <span>{avatarUploading ? "Uploading..." : "Choose photo"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={avatarUploading}
              />
            </label>
            <p className="text-[11px] text-slate-400">
              Recommended square image, at least 128x128px. Stored in Supabase
              Storage bucket <span className="font-mono">avatars</span>.
            </p>
            {avatarError ? (
              <p className="text-[11px] text-red-600">{avatarError}</p>
            ) : null}
            {avatarSuccess ? (
              <p className="text-[11px] text-emerald-600">{avatarSuccess}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="text-sm font-medium text-slate-900">Your name</h2>
        <p className="mt-1 text-xs text-slate-500">
          Update your first and last name displayed throughout the app.
        </p>
        <form onSubmit={handleNameSubmit} className="mt-3 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="first_name" className="block text-[11px] font-medium text-slate-600 mb-1">
                First name
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={profile.firstName}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, firstName: event.target.value } : prev
                  )
                }
                placeholder="First name"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="last_name" className="block text-[11px] font-medium text-slate-600 mb-1">
                Last name
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={profile.lastName}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, lastName: event.target.value } : prev
                  )
                }
                placeholder="Last name"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {nameError ? <p className="text-xs text-red-600">{nameError}</p> : null}
          {nameSuccess ? <p className="text-xs text-emerald-600">{nameSuccess}</p> : null}
          <button
            type="submit"
            disabled={nameSaving}
            className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] backdrop-blur hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {nameSaving ? "Saving..." : "Save name"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="text-sm font-medium text-slate-900">Email signature</h2>
        <p className="mt-1 text-xs text-slate-500">
          HTML signature appended to emails sent from this account.
        </p>
        <form onSubmit={handleSignatureSubmit} className="mt-3 space-y-3">
          <textarea
            id="signature_html"
            name="signature_html"
            value={profile.signatureHtml}
            onChange={(event) =>
              setProfile((prev) =>
                prev
                  ? { ...prev, signatureHtml: event.target.value }
                  : prev
              )
            }
            rows={5}
            className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-mono text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="&lt;p&gt;Dr. Jane Doe&lt;br/&gt;Clinic Name&lt;br/&gt;&lt;a href='tel:+971...'&gt;+971 ...&lt;/a&gt;&lt;/p&gt;"
          />

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {success ? <p className="text-xs text-emerald-600">{success}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] backdrop-blur hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save signature"}
          </button>
        </form>
        <div className="mt-4 rounded-lg border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Preview
          </h3>
          {profile.signatureHtml.trim() ? (
            <div
              className="mt-2 rounded-md bg-white px-3 py-2 text-xs text-slate-800"
              dangerouslySetInnerHTML={{ __html: profile.signatureHtml }}
            />
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">
              Your saved HTML signature will appear here.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="text-sm font-medium text-slate-900">Priority</h2>
        <p className="mt-1 text-xs text-slate-500">
          Choose which view opens by default when you open a patient. Changes are saved
          automatically when you switch.
        </p>
        <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50/80 p-0.5 text-[11px] text-slate-600">
          <button
            type="button"
            onClick={() => {
              void handlePriorityChange("crm");
            }}
            className={
              "rounded-full px-3 py-1 text-[11px] " +
              (profile.priorityMode === "crm"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            CRM
          </button>
          <button
            type="button"
            onClick={() => {
              void handlePriorityChange("medical");
            }}
            className={
              "rounded-full px-3 py-1 text-[11px] " +
              (profile.priorityMode === "medical"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            Medical
          </button>
        </div>
      </section>
    </div>
  );
}
