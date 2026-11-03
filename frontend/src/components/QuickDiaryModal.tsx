import { useState } from "react";
import { X } from "lucide-react";
import api from "../api/client";
import type { DiaryEntry } from "../types";

interface Props {
  // When the student is already known (opened from their profile), pass it
  // here and it's locked in. When opened from the dashboard with no student
  // in context yet, pass the full list instead so the tutor can pick one.
  student?: { id: string; fullName: string };
  students?: { _id: string; fullName: string }[];
  defaultDate?: string; // YYYY-MM-DD, defaults to today
  // Pass an existing entry to edit it in place (PATCH) instead of creating
  // a new one (POST).
  entry?: DiaryEntry;
  onClose: () => void;
  onSaved: () => void;
}

function todayDhakaStr(): string {
  const d = new Date(Date.now() + 6 * 60 * 60000);
  return d.toISOString().slice(0, 10);
}

export default function QuickDiaryModal({ student, students, defaultDate, entry, onClose, onSaved }: Props) {
  const isEdit = Boolean(entry);
  const [studentId, setStudentId] = useState(student?.id || (typeof entry?.student === "string" ? entry?.student : entry?.student?._id) || "");
  const [date, setDate] = useState(entry?.date || defaultDate || todayDhakaStr());
  const [subject, setSubject] = useState(entry?.subject || "");
  const [topic, setTopic] = useState(entry?.topic || "");
  const [taughtToday, setTaughtToday] = useState(entry?.taughtToday || "");
  const [homework, setHomework] = useState(entry?.homework || "");
  const [nextPrep, setNextPrep] = useState(entry?.nextPrep || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !subject.trim()) {
      setError("Student and subject are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      student: studentId,
      date,
      subject: subject.trim(),
      topic: topic || undefined,
      taughtToday: taughtToday || undefined,
      homework: homework || undefined,
      nextPrep: nextPrep || undefined,
      notes: notes || undefined,
    };
    try {
      if (isEdit && entry) {
        await api.patch(`/diary/${entry._id}`, payload);
      } else {
        await api.post("/diary", payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not save this entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-lg sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? "Edit diary entry" : "Add diary entry"}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {student ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{student.fullName}</div>
          ) : (
            <select
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select student…</option>
              {students?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <input
            placeholder="Topic / chapter (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="What was taught today (optional)"
            value={taughtToday}
            onChange={(e) => setTaughtToday(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <textarea
            placeholder="Homework assigned (optional)"
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <input
            placeholder="Next class prep (optional)"
            value={nextPrep}
            onChange={(e) => setNextPrep(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Additional notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save entry"}
          </button>
        </form>
      </div>
    </div>
  );
}
