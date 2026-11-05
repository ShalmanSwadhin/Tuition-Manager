import { useState } from "react";
import api from "../api/client";
import Sheet from "./Sheet";
import { todayDhakaStr } from "../utils/date";
import type { Student, Weekday } from "../types";

export const WEEKDAYS: { key: Weekday; short: string }[] = [
  { key: "SUN", short: "Sun" },
  { key: "MON", short: "Mon" },
  { key: "TUE", short: "Tue" },
  { key: "WED", short: "Wed" },
  { key: "THU", short: "Thu" },
  { key: "FRI", short: "Fri" },
  { key: "SAT", short: "Sat" },
];

interface Props {
  student?: Student; // edit; omit to add a new (no-account) student
  onClose: () => void;
  onSaved: (student: Student) => void;
}

export default function StudentFormModal({ student, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    fullName: student?.fullName || "",
    classGrade: student?.classGrade || "",
    school: student?.school || "",
    subjects: student?.subjects.join(", ") || "",
    monthlyClassTarget: student?.monthlyClassTarget ?? 12,
    guardianName: student?.guardianName || "",
    guardianPhone: student?.guardianPhone || "",
    notes: student?.notes || "",
    status: student?.status || "active",
    preferredDays: student?.preferredDays || ([] as Weekday[]),
    classTime: student?.classTime || "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      monthlyClassTarget: Number(form.monthlyClassTarget),
      subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      preferredDays: WEEKDAYS.map((w) => w.key).filter((k) => form.preferredDays.includes(k)),
    };
    try {
      const res = student
        ? await api.patch<Student>(`/students/${student._id}`, payload)
        : await api.post<Student>("/students", { ...payload, joiningDate: todayDhakaStr() });
      onSaved(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title={student ? "Edit student" : "Add student"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Full name</label>
          <input required value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Class</label>
            <input required value={form.classGrade} onChange={(e) => set({ classGrade: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Classes / month</label>
            <input
              required
              type="number"
              inputMode="numeric"
              min={1}
              value={form.monthlyClassTarget}
              onChange={(e) => set({ monthlyClassTarget: Number(e.target.value) })}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label">Class days</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map(({ key, short }) => {
              const on = form.preferredDays.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    set({ preferredDays: on ? form.preferredDays.filter((d) => d !== key) : [...form.preferredDays, key] })
                  }
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    on ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="label">Class time</label>
          <input type="time" value={form.classTime} onChange={(e) => set({ classTime: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">School</label>
          <input value={form.school} onChange={(e) => set({ school: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Subjects</label>
          <input value={form.subjects} onChange={(e) => set({ subjects: e.target.value })} placeholder="Math, Physics" className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Guardian</label>
            <input value={form.guardianName} onChange={(e) => set({ guardianName: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Guardian phone</label>
            <input type="tel" value={form.guardianPhone} onChange={(e) => set({ guardianPhone: e.target.value })} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className="input" />
        </div>
        {student && (
          <div>
            <label className="label">Status</label>
            <select value={form.status} onChange={(e) => set({ status: e.target.value as Student["status"] })} className="input">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </Sheet>
  );
}
