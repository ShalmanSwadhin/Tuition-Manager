import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, History, Search, CheckCircle2, Circle } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import DiaryFormModal from "./DiaryFormModal";
import { formatDate, formatDateTime } from "../utils/date";
import type { DiaryEntry, DiaryContent, DiaryVersion } from "../types";

interface Props {
  studentId?: string; // one student's diary; omit for every diary you can see
  studentName?: string;
  students?: { _id: string; fullName: string }[]; // for the "new entry" picker when studentId is omitted
  refreshKey?: number;
  title?: string;
}

const ROLE_WORD = { admin: "admin", teacher: "teacher", student: "student" } as const;

// A previous version, as plain text.
function versionText(v: DiaryContent): string {
  return [
    `Date: ${v.date}`,
    `Subject: ${v.subject}`,
    v.topic && `Topic: ${v.topic}`,
    v.taughtToday && `Covered: ${v.taughtToday}`,
    v.homework && `Homework: ${v.homework}`,
    v.nextPrep && `Next class: ${v.nextPrep}`,
    v.notes && `Notes: ${v.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function EditHistory({ history }: { history: DiaryVersion[] }) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      {[...history].reverse().map((v, i) => (
        <div key={i}>
          <p className="text-xs font-semibold text-amber-800">
            Before {v.editedBy.name} ({ROLE_WORD[v.editedBy.role]}) edited it · {formatDateTime(v.editedAt)}
          </p>
          <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-slate-700">{versionText(v)}</pre>
        </div>
      ))}
    </div>
  );
}

export default function DiaryList({ studentId, studentName, students, refreshKey = 0, title = "Diary" }: Props) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [subject, setSubject] = useState("");
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [adding, setAdding] = useState(false);

  function load() {
    api
      .get<DiaryEntry[]>("/diary", { params: { student: studentId, subject: subject || undefined } })
      .then((res) => setEntries(res.data));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [studentId, subject, refreshKey]);

  if (!user) return null;
  const isStudent = user.role === "student";
  const canEdit = (d: DiaryEntry) => !isStudent || d.author?.user === user.id;

  async function toggleHomework(d: DiaryEntry) {
    const homeworkStatus = d.homeworkStatus === "completed" ? "pending" : "completed";
    setEntries((list) => list?.map((e) => (e._id === d._id ? { ...e, homeworkStatus } : e)) ?? null);
    await api.patch(`/diary/${d._id}`, { homeworkStatus }).catch(load);
  }

  async function remove(d: DiaryEntry) {
    if (!confirm(`Delete the ${d.subject} entry from ${formatDate(d.date)}?`)) return;
    await api.delete(`/diary/${d._id}`);
    load();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <button onClick={() => setAdding(true)} className="btn-primary px-3 py-2">
          <Plus size={18} /> New entry
        </button>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Filter by subject" className="input pl-9" />
      </div>

      {entries === null ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">
          {subject ? "No entries for this subject." : "No diary entries yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((d) => {
            const student = typeof d.student === "object" ? d.student : null;
            const edited = d.history.length > 0;
            const lastEditor = edited ? d.history[d.history.length - 1].editedBy : null;
            const mine = d.author?.user === user.id;
            return (
              <li key={d._id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{formatDate(d.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className="text-base font-semibold text-slate-900">
                      {d.subject}
                      {!studentId && student && <span className="font-normal text-slate-500"> · {student.fullName}</span>}
                    </p>
                    {d.topic && <p className="text-sm text-slate-600">{d.topic}</p>}
                  </div>
                  {edited && (
                    <button
                      onClick={() => setOpenHistory(openHistory === d._id ? null : d._id)}
                      className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                    >
                      <History size={13} /> Edited{lastEditor?.role === "student" ? " by student" : ""}
                    </button>
                  )}
                </div>

                <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                  {d.taughtToday && <p className="whitespace-pre-wrap"><span className="font-medium text-slate-500">Covered: </span>{d.taughtToday}</p>}
                  {d.homework && <p className="whitespace-pre-wrap"><span className="font-medium text-slate-500">Homework: </span>{d.homework}</p>}
                  {d.nextPrep && <p className="whitespace-pre-wrap"><span className="font-medium text-slate-500">Next class: </span>{d.nextPrep}</p>}
                  {d.notes && <p className="whitespace-pre-wrap"><span className="font-medium text-slate-500">Notes: </span>{d.notes}</p>}
                </div>

                {openHistory === d._id && <EditHistory history={d.history} />}

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  {d.homework ? (
                    <button
                      onClick={() => toggleHomework(d)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        d.homeworkStatus === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {d.homeworkStatus === "completed" ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                      {d.homeworkStatus === "completed" ? "Homework done" : "Homework pending"}
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-xs text-slate-400">by {mine ? "you" : d.author?.name || "—"}</span>
                    {canEdit(d) && (
                      <button onClick={() => setEditing(d)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Edit">
                        <Pencil size={16} />
                      </button>
                    )}
                    {!isStudent && (
                      <button onClick={() => remove(d)} className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(adding || editing) && (
        <DiaryFormModal
          studentId={studentId}
          studentName={studentName}
          students={students}
          entry={editing || undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}
