import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, ChevronRight } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import StudentFormModal from "../components/StudentFormModal";
import TeacherKeyCard from "../components/TeacherKeyCard";
import type { Student, TeacherSummary } from "../types";

export default function Students() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [params, setParams] = useSearchParams();
  const teacherFilter = params.get("teacher") || "";
  const [students, setStudents] = useState<Student[] | null>(null);
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "archived" | "">("active");
  const [adding, setAdding] = useState(false);

  function load() {
    api
      .get<Student[]>("/students", {
        params: { search: search || undefined, status: status || undefined, teacher: teacherFilter || undefined },
      })
      .then((res) => setStudents(res.data));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [search, status, teacherFilter]);

  useEffect(() => {
    if (isAdmin) api.get<TeacherSummary[]>("/admin/teachers").then((res) => setTeachers(res.data));
  }, [isAdmin]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Students</h1>
        {user?.role === "teacher" && (
          <button onClick={() => setAdding(true)} className="btn-secondary px-3 py-2">
            <Plus size={18} /> Add
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="input pl-9" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["active", "paused", "archived", ""] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              status === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
      </div>

      {isAdmin && (
        <select
          value={teacherFilter}
          onChange={(e) => setParams(e.target.value ? { teacher: e.target.value } : {})}
          className="input"
        >
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {students === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : students.length === 0 ? (
        user?.role === "teacher" && status === "active" && !search ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">No students yet. Share your key — students who sign up with it appear here.</p>
            <TeacherKeyCard />
          </div>
        ) : (
          <p className="card text-center text-sm text-slate-500">No students match.</p>
        )
      ) : (
        <ul className="card divide-y divide-slate-100 p-0">
          {students.map((s) => (
            <li key={s._id}>
              <Link to={`/students/${s._id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: s.color }}
                >
                  {s.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{s.fullName}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {s.classGrade} · {s.monthlyClassTarget} classes/month
                    {isAdmin && typeof s.teacher === "object" ? ` · ${s.teacher.name}` : ""}
                    {!s.user ? " · no app account" : ""}
                  </span>
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <StudentFormModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}
