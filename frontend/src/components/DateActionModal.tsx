import { useState } from "react";
import { X, CheckCircle2, CalendarClock, Ban, Trash2 } from "lucide-react";
import api from "../api/client";
import type { ClassSession, ClassStatus } from "../types";

interface Props {
  studentId: string;
  dateStr: string;
  existing: ClassSession | null;
  onClose: () => void;
  // Called after a successful change. wasNewlyCompleted tells the caller
  // whether this change just turned the date into a completed class, so it
  // can offer the "add a diary entry?" prompt.
  onChanged: (wasNewlyCompleted: boolean) => void;
}

export default function DateActionModal({ studentId, dateStr, existing, onClose, onChanged }: Props) {
  const [note, setNote] = useState(existing?.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark(status: ClassStatus) {
    setBusy(true);
    setError(null);
    try {
      await api.post("/classes/mark", { student: studentId, date: dateStr, status, note: note || undefined });
      onChanged(status === "completed" && existing?.status !== "completed");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not update this date");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!existing) return;
    if (!confirm(`Remove the ${existing.status} record for ${dateStr}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/classes/${existing._id}`);
      onChanged(false);
    } catch {
      setError("Could not remove this record");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-lg sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{dateStr}</h2>
            {existing && <p className="text-xs capitalize text-slate-400">Currently {existing.status}</p>}
          </div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <button
            disabled={busy}
            onClick={() => mark("completed")}
            className="flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <CheckCircle2 size={16} /> Mark as Completed
          </button>
          <button
            disabled={busy}
            onClick={() => mark("scheduled")}
            className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            <CalendarClock size={16} /> Schedule Class
          </button>
          <button
            disabled={busy}
            onClick={() => mark("cancelled")}
            className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            <Ban size={16} /> Cancel Class
          </button>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-slate-500">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. covered chapter 4"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Saved the next time you choose a status above.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {existing && (
          <button
            disabled={busy}
            onClick={handleRemove}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 size={16} /> Remove record
          </button>
        )}
      </div>
    </div>
  );
}
