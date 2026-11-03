import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import api from "../api/client";
import type { Student } from "../types";

const emptyForm = {
  fullName: "",
  classGrade: "",
  subjects: "",
  guardianName: "",
  guardianPhone: "",
  monthlyClassTarget: 12,
  joiningDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "">("active");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<Student[]>("/students", { params: { search: search || undefined, status: status || undefined } })
      .then((res) => setStudents(res.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/students", {
        ...form,
        monthlyClassTarget: Number(form.monthlyClassTarget),
        subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not create student");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Students</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Add student
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
          <option value="">All</option>
        </select>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-slate-400">No students match this view yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <Link
              key={s._id}
              to={`/students/${s._id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <p className="font-medium text-slate-900">{s.fullName}</p>
              </div>
              <p className="text-xs text-slate-500">{s.classGrade}</p>
              <p className="mt-2 text-xs text-slate-400">Target: {s.monthlyClassTarget} classes/month</p>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add student</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Class / grade"
                value={form.classGrade}
                onChange={(e) => setForm({ ...form, classGrade: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Subjects (comma separated)"
                value={form.subjects}
                onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Guardian name"
                  value={form.guardianName}
                  onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Guardian phone"
                  value={form.guardianPhone}
                  onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Monthly class target</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={form.monthlyClassTarget}
                    onChange={(e) => setForm({ ...form, monthlyClassTarget: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Joining date</label>
                  <input
                    required
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Save student
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
