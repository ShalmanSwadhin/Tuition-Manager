import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import api from "../api/client";
import type { DiaryEntry, Student } from "../types";

const emptyForm = {
  student: "",
  date: new Date().toISOString().slice(0, 10),
  subject: "",
  topic: "",
  taughtToday: "",
  homework: "",
  nextPrep: "",
  notes: "",
};

export default function Diary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filterStudent, setFilterStudent] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    api.get<Student[]>("/students", { params: { status: "active" } }).then((res) => setStudents(res.data));
  }, []);

  function load() {
    api.get<DiaryEntry[]>("/diary", { params: { student: filterStudent || undefined } }).then((res) => setEntries(res.data));
  }

  useEffect(load, [filterStudent]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.student) return;
    await api.post("/diary", form);
    setShowForm(false);
    setForm({ ...emptyForm, student: form.student });
    load();
  }

  async function toggleHomework(entry: DiaryEntry) {
    await api.patch(`/diary/${entry._id}`, {
      homeworkStatus: entry.homeworkStatus === "completed" ? "pending" : "completed",
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Daily diary</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New entry
        </button>
      </div>

      <select
        value={filterStudent}
        onChange={(e) => setFilterStudent(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All students</option>
        {students.map((s) => (
          <option key={s._id} value={s._id}>
            {s.fullName}
          </option>
        ))}
      </select>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No diary entries yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((d) => {
            const student = typeof d.student === "object" ? d.student : null;
            return (
              <li key={d._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">
                    {student?.fullName} · {d.subject}
                  </p>
                  <span className="text-xs text-slate-400">{d.date}</span>
                </div>
                {d.topic && <p className="mt-1 text-sm text-slate-600">{d.topic}</p>}
                {d.homework && <p className="mt-1 text-xs text-slate-500">Homework: {d.homework}</p>}
                <button
                  onClick={() => toggleHomework(d)}
                  className={`mt-2 rounded-full px-2.5 py-1 text-xs font-medium ${
                    d.homeworkStatus === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  Homework: {d.homeworkStatus}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">New diary entry</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <select
                required
                value={form.student}
                onChange={(e) => setForm({ ...form, student: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Topic / chapter"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="What was taught today"
                value={form.taughtToday}
                onChange={(e) => setForm({ ...form, taughtToday: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Homework assigned"
                value={form.homework}
                onChange={(e) => setForm({ ...form, homework: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Save entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
