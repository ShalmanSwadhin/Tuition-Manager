import { useEffect, useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import api from "../api/client";
import Sheet from "./Sheet";
import { formatDate, todayDhakaStr } from "../utils/date";
import type { ExamResult } from "../types";

const percent = (e: ExamResult) => Math.round((e.obtainedMarks / e.totalMarks) * 1000) / 10;

function barColor(p: number) {
  if (p >= 80) return "bg-emerald-500";
  if (p >= 60) return "bg-sky-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function ExamForm({ studentId, onClose, onSaved }: { studentId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ examName: "", subject: "", examDate: todayDhakaStr(), totalMarks: "100", obtainedMarks: "", comments: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/exams", {
        student: studentId,
        examName: form.examName,
        subject: form.subject,
        examDate: form.examDate,
        totalMarks: Number(form.totalMarks),
        obtainedMarks: Number(form.obtainedMarks),
        comments: form.comments || undefined,
      });
      onSaved();
    } catch (err: any) {
      const data = err?.response?.data;
      const fieldError = data?.details?.fieldErrors && Object.values(data.details.fieldErrors).flat()[0];
      setError((fieldError as string) || data?.error || "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <Sheet title="Add exam result" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Exam</label>
            <input required value={form.examName} onChange={(e) => set({ examName: e.target.value })} placeholder="e.g. Class test 2" className="input" />
          </div>
          <div>
            <label className="label">Subject</label>
            <input required value={form.subject} onChange={(e) => set({ subject: e.target.value })} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Marks</label>
            <input required type="number" inputMode="decimal" min={0} step="any" value={form.obtainedMarks} onChange={(e) => set({ obtainedMarks: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Out of</label>
            <input required type="number" inputMode="decimal" min={1} step="any" value={form.totalMarks} onChange={(e) => set({ totalMarks: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Date</label>
            <input required type="date" value={form.examDate} onChange={(e) => set({ examDate: e.target.value })} className="input px-2" />
          </div>
        </div>
        <div>
          <label className="label">
            Comment <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input value={form.comments} onChange={(e) => set({ comments: e.target.value })} className="input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Saving…" : "Save result"}
        </button>
      </form>
    </Sheet>
  );
}

export default function ExamResults({ studentId, canManage }: { studentId: string; canManage: boolean }) {
  const [exams, setExams] = useState<ExamResult[] | null>(null);
  const [adding, setAdding] = useState(false);

  function load() {
    api.get<ExamResult[]>("/exams", { params: { student: studentId } }).then((res) => setExams(res.data));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [studentId]);

  async function remove(e: ExamResult) {
    if (!confirm(`Delete the result for ${e.examName}?`)) return;
    await api.delete(`/exams/${e._id}`);
    load();
  }

  if (exams === null) return null;
  if (exams.length === 0 && !canManage) return null;

  const average = exams.length ? Math.round((exams.reduce((s, e) => s + percent(e), 0) / exams.length) * 10) / 10 : 0;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Exam results</h2>
        {canManage && (
          <button onClick={() => setAdding(true)} className="btn-secondary px-3 py-2">
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      {exams.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">No results yet. Add class test or school exam marks to track progress.</p>
      ) : (
        <div className="card space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <Trophy className="text-amber-500" />
            <div>
              <p className="text-xl font-bold text-slate-900">{average}%</p>
              <p className="text-xs text-slate-500">
                Average across {exams.length} exam{exams.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {exams.map((e) => {
              const p = percent(e);
              return (
                <li key={e._id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-slate-800">{e.examName}</span>
                      <span className="text-slate-500"> · {e.subject}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="font-semibold text-slate-900">
                        {e.obtainedMarks}/{e.totalMarks}
                      </span>
                      {canManage && (
                        <button onClick={() => remove(e)} className="rounded-full p-1 text-slate-400 hover:text-red-600" aria-label="Delete result">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${barColor(p)}`} style={{ width: `${Math.min(p, 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {p}% · {formatDate(e.examDate)}
                    {e.comments ? ` · ${e.comments}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {adding && (
        <ExamForm
          studentId={studentId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </section>
  );
}
