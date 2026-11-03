import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import api from "../api/client";
import type { DiaryEntry } from "../types";
import QuickDiaryModal from "./QuickDiaryModal";

interface Props {
  studentId: string;
  studentName: string;
  refreshKey: number; // bump this from the parent to force a reload (e.g. after marking attendance)
}

export default function DiaryHistory({ studentId, studentName, refreshKey }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [editing, setEditing] = useState<DiaryEntry | null>(null);

  function load() {
    api
      .get<DiaryEntry[]>("/diary", {
        params: { student: studentId, date: filterDate || undefined, subject: filterSubject || undefined },
      })
      .then((res) => setEntries(res.data));
  }

  useEffect(load, [studentId, filterDate, filterSubject, refreshKey]);

  async function handleDelete(entry: DiaryEntry) {
    if (!confirm(`Delete the ${entry.date} diary entry for ${entry.subject}?`)) return;
    await api.delete(`/diary/${entry._id}`);
    load();
  }

  async function toggleHomework(entry: DiaryEntry) {
    await api.patch(`/diary/${entry._id}`, {
      homeworkStatus: entry.homeworkStatus === "completed" ? "pending" : "completed",
    });
    load();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Diary history</h2>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
        />
        <input
          placeholder="Filter by subject…"
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
        />
        {(filterDate || filterSubject) && (
          <button
            onClick={() => {
              setFilterDate("");
              setFilterSubject("");
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          {filterDate || filterSubject ? "No entries match this filter." : "No diary entries yet — add one after your next class."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((d) => {
            const isOpen = expanded === d._id;
            return (
              <li key={d._id} className="py-2">
                <button
                  onClick={() => setExpanded(isOpen ? null : d._id)}
                  className="flex w-full items-center justify-between text-left text-sm"
                >
                  <span>
                    <span className="font-medium text-slate-800">{d.date}</span>{" "}
                    <span className="text-slate-500">· {d.subject}</span>
                    {d.topic && <span className="text-slate-400"> — {d.topic}</span>}
                  </span>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {isOpen && (
                  <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    {d.taughtToday && (
                      <p>
                        <span className="font-medium text-slate-700">Taught: </span>
                        {d.taughtToday}
                      </p>
                    )}
                    {d.homework && (
                      <p>
                        <span className="font-medium text-slate-700">Homework: </span>
                        {d.homework}
                      </p>
                    )}
                    {d.nextPrep && (
                      <p>
                        <span className="font-medium text-slate-700">Next prep: </span>
                        {d.nextPrep}
                      </p>
                    )}
                    {d.notes && (
                      <p>
                        <span className="font-medium text-slate-700">Notes: </span>
                        {d.notes}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => toggleHomework(d)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          d.homeworkStatus === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        Homework: {d.homeworkStatus}
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(d)} className="text-slate-400 hover:text-slate-700">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(d)} className="text-slate-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <QuickDiaryModal
          student={{ id: studentId, fullName: studentName }}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
