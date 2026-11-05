import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import api from "../api/client";
import type { TeacherSummary } from "../types";

export default function Teachers() {
  const [teachers, setTeachers] = useState<TeacherSummary[] | null>(null);

  useEffect(() => {
    api.get<TeacherSummary[]>("/admin/teachers").then((res) => setTeachers(res.data));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="page-title">Teachers</h1>
      {teachers === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : teachers.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">No teachers have signed up yet.</p>
      ) : (
        <ul className="card divide-y divide-slate-100 p-0">
          {teachers.map((t) => (
            <li key={t.id}>
              <Link to={`/students?teacher=${t.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{t.name}</span>
                  <span className="block truncate text-xs text-slate-500">{t.email}</span>
                  <span className="mt-1 inline-flex items-center gap-2 text-xs">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono font-semibold tracking-wider text-slate-700">
                      {t.teacherKey}
                    </span>
                    <span className="text-slate-500">
                      {t.studentCount} student{t.studentCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
