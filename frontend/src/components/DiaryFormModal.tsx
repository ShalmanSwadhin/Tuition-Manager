import { useState } from "react";
import api from "../api/client";
import Sheet from "./Sheet";
import { todayDhakaStr } from "../utils/date";
import type { DiaryEntry } from "../types";

interface Props {
  // Known student (their profile, or a student's own diary): locked in.
  // Otherwise pass `students` so a teacher can pick one.
  studentId?: string;
  studentName?: string;
  students?: { _id: string; fullName: string }[];
  defaultDate?: string;
  entry?: DiaryEntry; // edit this entry instead of creating one
  onClose: () => void;
  onSaved: () => void;
}

const TEXT_FIELDS = [
  { key: "topic", label: "Topic / chapter", rows: 1 },
  { key: "taughtToday", label: "What was covered today", rows: 3 },
  { key: "homework", label: "Homework", rows: 2 },
  { key: "nextPrep", label: "Prepare for next class", rows: 2 },
  { key: "notes", label: "Notes", rows: 2 },
] as const;

type TextKey = (typeof TEXT_FIELDS)[number]["key"];

export default function DiaryFormModal({ studentId, studentName, students, defaultDate, entry, onClose, onSaved }: Props) {
  const isEdit = Boolean(entry);
  const [pickedStudent, setPickedStudent] = useState(studentId || "");
  const [date, setDate] = useState(entry?.date || defaultDate || todayDhakaStr());
  const [subject, setSubject] = useState(entry?.subject || "");
  const [text, setText] = useState<Record<TextKey, string>>({
    topic: entry?.topic || "",
    taughtToday: entry?.taughtToday || "",
    homework: entry?.homework || "",
    nextPrep: entry?.nextPrep || "",
    notes: entry?.notes || "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsPicker = !studentId && !isEdit && students;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsPicker && !pickedStudent) return setError("Choose a student.");
    if (!subject.trim()) return setError("Subject is required.");
    setSaving(true);
    setError(null);
    // Send every field (blank included) so clearing a field on edit sticks.
    const payload = { date, subject: subject.trim(), ...text };
    try {
      if (isEdit && entry) {
        await api.patch(`/diary/${entry._id}`, payload);
      } else {
        await api.post("/diary", { ...payload, student: pickedStudent || undefined });
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not save this entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title={isEdit ? "Edit diary entry" : "New diary entry"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {needsPicker ? (
          <select value={pickedStudent} onChange={(e) => setPickedStudent(e.target.value)} className="input">
            <option value="">Choose student…</option>
            {students!.map((s) => (
              <option key={s._id} value={s._id}>
                {s.fullName}
              </option>
            ))}
          </select>
        ) : (
          studentName && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{studentName}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Subject</label>
            <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Math" className="input" />
          </div>
        </div>

        {TEXT_FIELDS.map(({ key, label, rows }) => (
          <div key={key}>
            <label className="label">
              {label} <span className="font-normal text-slate-400">(optional)</span>
            </label>
            {rows === 1 ? (
              <input value={text[key]} onChange={(e) => setText({ ...text, [key]: e.target.value })} className="input" />
            ) : (
              <textarea
                rows={rows}
                value={text[key]}
                onChange={(e) => setText({ ...text, [key]: e.target.value })}
                className="input"
              />
            )}
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save entry"}
        </button>
      </form>
    </Sheet>
  );
}
