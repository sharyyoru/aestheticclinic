"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ReconstructionType = "breast" | "face" | "body";

export default function Patient3DSetupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [step, setStep] = useState<"select" | "choice" | "form">("select");
  const [type, setType] = useState<ReconstructionType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingPlayerId, setExistingPlayerId] = useState<string | null>(null);
  const [leftPreviewUrl, setLeftPreviewUrl] = useState<string | null>(null);
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null);
  const [rightPreviewUrl, setRightPreviewUrl] = useState<string | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);

  const patientId = params?.id ?? "";

  async function handleSelect(nextType: ReconstructionType) {
    setError(null);
    setCheckingExisting(true);
    setType(nextType);
    setExistingPlayerId(null);

    try {
      const response = await fetch("/api/crisalix/reconstructions/existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, reconstructionType: nextType }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          exists?: boolean;
          playerId?: string | null;
        };

        if (data.exists && data.playerId) {
          setExistingPlayerId(data.playerId);
          setCheckingExisting(false);
          setStep("choice");
          return;
        }
      }
    } catch {
      // ignore and fall back to creating new
    }

    setCheckingExisting(false);
    setStep("form");
  }

  function handleCancel() {
    router.push(`/patients/${patientId}?mode=medical`);
  }

  function handleUseExisting() {
    if (!type || !existingPlayerId) return;

    void (async () => {
      try {
        await fetch("/api/consultations/3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            reconstructionType: type,
            playerId: existingPlayerId,
          }),
        });
      } catch {
      }

      router.push(`/patients/${patientId}?mode=medical&m_tab=3d`);
    })();
  }

  function handleCreateNew() {
    setExistingPlayerId(null);
    setStep("form");
  }

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
    kind: "left" | "front" | "right" | "back",
  ) {
    const file = event.target.files?.[0] ?? null;

    const setPreview =
      kind === "left"
        ? setLeftPreviewUrl
        : kind === "front"
          ? setFrontPreviewUrl
          : kind === "right"
            ? setRightPreviewUrl
            : setBackPreviewUrl;

    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("patient_id", String(patientId));
      formData.set("reconstruction_type", type);

      const response = await fetch("/api/crisalix/patients", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Failed to create 3D reconstruction.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        setError(message);
        setSubmitting(false);
        return;
      }

      const data = (await response.json()) as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patient?: { player_id?: string | null } & Record<string, any>;
      };
      const playerId = data.patient?.player_id ?? null;

      if (playerId) {
        try {
          await fetch("/api/consultations/3d", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId,
              reconstructionType: type,
              playerId,
            }),
          });
        } catch {
        }
      }

      router.push(`/patients/${patientId}?mode=medical&m_tab=3d`);
    } catch (err) {
      setError("Unexpected error while creating 3D reconstruction.");
      // eslint-disable-next-line no-console
      console.error(err);
      setSubmitting(false);
    }
  }

  const title =
    type === "breast"
      ? "Breast (Mammo)"
      : type === "face"
        ? "Face"
        : type === "body"
          ? "Body"
          : "";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        {step === "select" ? (
          <div className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Select Reconstruction Type
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Select which reconstruction type to view:
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <button
                type="button"
                onClick={() => handleSelect("breast")}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 disabled:opacity-60"
                disabled={checkingExisting}
              >
                <span className="font-medium">Breast (Mammo)</span>
                <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  Setup Required
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("face")}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 disabled:opacity-60"
                disabled={checkingExisting}
              >
                <span className="font-medium">Face</span>
                <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  Setup Required
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("body")}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 disabled:opacity-60"
                disabled={checkingExisting}
              >
                <span className="font-medium">Body</span>
                <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  Setup Required
                </span>
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              {checkingExisting ? (
                <p className="text-[11px] text-slate-500">
                  Checking for existing 3D simulations...
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center rounded-full bg-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : step === "choice" ? (
          <div className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Existing 3D reconstruction found
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  This patient already has a 3D simulation for this reconstruction type. You can
                  load the existing 3D or create a new one.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="mt-2 space-y-3 text-xs">
              <button
                type="button"
                onClick={handleUseExisting}
                className="flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-600 px-4 py-3 text-left text-slate-50 shadow-sm hover:bg-sky-700"
              >
                <div>
                  <p className="text-xs font-semibold">Load existing 3D simulation</p>
                  <p className="mt-0.5 text-[11px] text-sky-100">
                    Open the Crisalix viewer with the last saved 3D for this type.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleCreateNew}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 shadow-sm hover:border-amber-300 hover:bg-amber-50"
              >
                <div>
                  <p className="text-xs font-semibold">Create a new 3D simulation</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Start a new 3D reconstruction using the photos and measurements you
                    provide.
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center rounded-full bg-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  3D Reconstruction Setup
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Configure the reconstruction details and upload the required images.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4 text-xs md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Reconstruction Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={title}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Provider <span className="text-red-500">*</span>
                </label>
                <select
                  name="provider"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                  defaultValue="Provider 4"
                >
                  <option value="Provider 1">Provider 1</option>
                  <option value="Provider 2">Provider 2</option>
                  <option value="Provider 3">Provider 3</option>
                  <option value="Provider 4">Provider 4</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Required Images
              </h3>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Left Profile <span className="text-red-500">*</span>
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-4 text-center text-[11px] font-medium text-sky-700 hover:bg-sky-100">
                    <span>Click to upload</span>
                    <span className="mt-0.5 text-[10px] font-normal text-slate-500">
                      JPG, PNG or similar
                    </span>
                    <input
                      type="file"
                      name="left_profile"
                      accept="image/*"
                      required
                      className="sr-only"
                      onChange={(event) => handleImageChange(event, "left")}
                    />
                  </label>
                  {leftPreviewUrl ? (
                    <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img
                        src={leftPreviewUrl}
                        alt="Left profile preview"
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Front/Portrait <span className="text-red-500">*</span>
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-4 text-center text-[11px] font-medium text-sky-700 hover:bg-sky-100">
                    <span>Click to upload</span>
                    <span className="mt-0.5 text-[10px] font-normal text-slate-500">
                      JPG, PNG or similar
                    </span>
                    <input
                      type="file"
                      name="front_profile"
                      accept="image/*"
                      required
                      className="sr-only"
                      onChange={(event) => handleImageChange(event, "front")}
                    />
                  </label>
                  {frontPreviewUrl ? (
                    <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img
                        src={frontPreviewUrl}
                        alt="Front/portrait preview"
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Right Profile <span className="text-red-500">*</span>
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-4 text-center text-[11px] font-medium text-sky-700 hover:bg-sky-100">
                    <span>Click to upload</span>
                    <span className="mt-0.5 text-[10px] font-normal text-slate-500">
                      JPG, PNG or similar
                    </span>
                    <input
                      type="file"
                      name="right_profile"
                      accept="image/*"
                      required
                      className="sr-only"
                      onChange={(event) => handleImageChange(event, "right")}
                    />
                  </label>
                  {rightPreviewUrl ? (
                    <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img
                        src={rightPreviewUrl}
                        alt="Right profile preview"
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {type === "body" ? (
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-700">
                      Back Profile <span className="text-red-500">*</span>
                    </label>
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-4 text-center text-[11px] font-medium text-sky-700 hover:bg-sky-100">
                      <span>Click to upload</span>
                      <span className="mt-0.5 text-[10px] font-normal text-slate-500">
                        JPG, PNG or similar
                      </span>
                      <input
                        type="file"
                        name="back_profile"
                        accept="image/*"
                        required
                        className="sr-only"
                        onChange={(event) => handleImageChange(event, "back")}
                      />
                    </label>
                    {backPreviewUrl ? (
                      <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <img
                          src={backPreviewUrl}
                          alt="Back profile preview"
                          className="h-32 w-full object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-2 text-xs">
              {type === "breast" && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Nipple to Nipple Distance (cm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="nipple_to_nipple_cm"
                    placeholder="e.g., 18.5"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              )}

              {type === "face" && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Pupillary Distance (cm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="pupillary_distance_cm"
                    placeholder="e.g., 6.3"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              )}

              {type === "body" && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Hipline (cm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="hipline_cm"
                    placeholder="e.g., 95.0"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              )}
            </div>

            {error ? (
              <p className="mt-3 text-[11px] text-red-600">{error}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center rounded-full bg-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-full bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create 3D Reconstruction"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
