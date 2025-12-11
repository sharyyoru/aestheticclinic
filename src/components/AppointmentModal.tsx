"use client";

import { useState, useEffect } from "react";

type AppointmentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AppointmentData) => Promise<void>;
  patientId: string;
  patientName: string;
  dealId?: string | null;
  dealTitle?: string | null;
};

export type AppointmentData = {
  patientId: string;
  dealId?: string | null;
  title: string;
  appointmentDate: string;
  durationMinutes: number;
  location: string;
  notes: string;
  sendPatientEmail: boolean;
  sendUserEmail: boolean;
  scheduleReminder: boolean;
};

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AppointmentModal({
  open,
  onClose,
  onSubmit,
  patientId,
  patientName,
  dealId,
  dealTitle,
}: AppointmentModalProps) {
  const [title, setTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [location, setLocation] = useState("Geneva");
  const [notes, setNotes] = useState("");
  const [sendPatientEmail, setSendPatientEmail] = useState(true);
  const [sendUserEmail, setSendUserEmail] = useState(true);
  const [scheduleReminder, setScheduleReminder] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Set default date to tomorrow at 10:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      setAppointmentDate(formatDateTimeLocal(tomorrow));
      setTitle(`Appointment with ${patientName}`);
      setError(null);
    }
  }, [open, patientName]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!appointmentDate) {
      setError("Please select a date and time for the appointment.");
      return;
    }

    const appointmentDateObj = new Date(appointmentDate);
    if (appointmentDateObj.getTime() < Date.now()) {
      setError("Appointment date must be in the future.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSubmit({
        patientId,
        dealId,
        title: title.trim() || `Appointment with ${patientName}`,
        appointmentDate,
        durationMinutes: parseInt(durationMinutes, 10) || 60,
        location: location.trim(),
        notes: notes.trim(),
        sendPatientEmail,
        sendUserEmail,
        scheduleReminder,
      });

      // Reset form
      setTitle("");
      setAppointmentDate("");
      setDurationMinutes("60");
      setLocation("Geneva");
      setNotes("");
      setSendPatientEmail(true);
      setSendUserEmail(true);
      setScheduleReminder(true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Schedule Appointment</h2>
            <p className="text-sm text-slate-500">
              {dealTitle ? `For deal: ${dealTitle}` : `Patient: ${patientName}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Appointment Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Appointment with ${patientName}`}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Location
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Geneva">Geneva</option>
              <option value="Montreaux">Montreaux</option>
              <option value="Gstaad">Gstaad</option>
              <option value="Video Call">Video Call</option>
              <option value="Phone Call">Phone Call</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this appointment..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Email Notifications</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={sendPatientEmail}
                  onChange={(e) => setSendPatientEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  Send confirmation email to patient
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={sendUserEmail}
                  onChange={(e) => setSendUserEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  Send notification email to me
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={scheduleReminder}
                  onChange={(e) => setScheduleReminder(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  Send reminder 1 day before appointment
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full border border-emerald-500 bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
