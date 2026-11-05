import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Phone, BookOpen, X } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import MonthCalendar, { CalendarMark } from "../components/MonthCalendar";
import DiaryList from "../components/DiaryList";
import DiaryFormModal from "../components/DiaryFormModal";
import StudentFormModal from "../components/StudentFormModal";
import { summarize } from "../utils/attendance";
import { todayDhakaStr, formatDate, shiftMonth } from "../utils/date";
import type { Student, ClassSession, ExamResult } from "../types";

// One student's page. Teachers/admin reach it at /students/:id and can tap
// days to mark attendance; a student sees their own at "/" (read-only
// attendance, but they can write in their diary).
export default function StudentProfile({ selfId }: { selfId?: string }) {
  const params = useParams<{ id: string }>();
  const id = selfId || params.id;
  const { user } = useAuth();
  const canMark = user?.role === "teacher" || user?.role === "admin";

  const [student, setStudent] = useState<Student | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const today = todayDhakaStr();
  const [ym, setYm] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [editing, setEditing] = useState(false);
  const [diaryRefresh, setDiaryRefresh] = useState(0);
  const [justMarked, setJustMarked] = useState<string | null>(null); // offers "add diary" after a tap
  const [diaryForDate, setDiaryForDate] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<Student>(`/students/${id}`)
      .then((res) => setStudent(res.data))
      .catch(() => setNotFound(true));
    api.get<ExamResult[]>("/exams", { params: { student: id } }).then((res) => setExams(res.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api
      .get<ClassSession[]>("/classes", { params: { student: id, month: ym.month, year: ym.year } })
      .then((res) => setSessions(res.data));
  }, [id, ym]);

  const marks = useMemo(() => {
    const m: Record<string, CalendarMark> = {};
    for (const s of sessions) if (s.status === "completed") m[s.date] = {};
    return m;
  }, [sessions]);

  async function toggleDay(dateStr: string) {
    if (!student) return;
    const wasPresent = Boolean(marks[dateStr]);
    if (wasPresent && !confirm(`Remove the present mark for ${formatDate(dateStr)}?`)) return;

    // Update the calendar right away; roll back if the server says no.
    const previous = sessions;
    setSessions(
      wasPresent
        ? sessions.filter((s) => s.date !== dateStr)
        : [...sessions.filter((s) => s.date !== dateStr), { _id: `tmp-${dateStr}`, student: student._id, date: dateStr, status: "completed" }]
    );
    setJustMarked(wasPresent ? null : dateStr);
    try {
      await api.post("/classes/toggle", { student: student._id, date: dateStr });
    } catch (err: any) {
      setSessions(previous);
      setJustMarked(null);
      alert(err?.response?.data?.error || "Couldn't update attendance");
    }
  }

  useEffect(() => {
    if (!justMarked) return;
    const t = setTimeout(() => setJustMarked(null), 6000);
    return () => clearTimeout(t);
  }, [justMarked]);

  if (notFound) return <p className="text-sm text-slate-500">Student not found.</p>;
  if (!student || !user) return <p className="text-sm text-slate-400">Loading…</p>;

  const completed = Object.keys(marks).length;
  const { remaining, progressPercent } = summarize(student.monthlyClassTarget, completed);
  const teacherName = typeof student.teacher === "object" ? student.teacher.name : undefined;
  const accountEmail = typeof student.user === "object" ? student.user.email : undefined;
  const isSelf = user.role === "student";

  return (
    <div className="space-y-5">
      {!isSelf && (
        <Link to="/students" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500">
          <ArrowLeft size={16} /> Students
        </Link>
      )}

      <div className="flex items-start gap-3">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
          style={{ background: student.color }}
        >
          {student.fullName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{isSelf ? `Hi, ${student.fullName.split(" ")[0]}` : student.fullName}</h1>
          <p className="text-sm text-slate-500">
            {student.classGrade}
            {student.school ? ` · ${student.school}` : ""}
          </p>
          <p className="text-xs text-slate-400">
            {isSelf
              ? `Teacher: ${user.teacherName || teacherName || "—"}`
              : [teacherName && user.role === "admin" ? `Teacher: ${teacherName}` : null, accountEmail || "No app account"]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        {canMark && (
          <button onClick={() => setEditing(true)} className="btn-secondary px-3 py-2" aria-label="Edit student">
            <Pencil size={16} />
          </button>
        )}
      </div>

      <section className="card">
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 py-2">
            <p className="text-xl font-bold text-emerald-700">{completed}</p>
            <p className="text-[11px] font-medium text-emerald-700">Present</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-2">
            <p className="text-xl font-bold text-slate-900">{student.monthlyClassTarget}</p>
            <p className="text-[11px] font-medium text-slate-500">Target</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-2">
            <p className="text-xl font-bold text-slate-900">{remaining}</p>
            <p className="text-[11px] font-medium text-slate-500">Remaining</p>
          </div>
        </div>
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
        </div>

        <MonthCalendar
          year={ym.year}
          month={ym.month}
          todayStr={today}
          marks={marks}
          onPrevMonth={() => setYm(shiftMonth(ym.year, ym.month, -1))}
          onNextMonth={() => setYm(shiftMonth(ym.year, ym.month, 1))}
          onDayClick={canMark ? toggleDay : undefined}
        />
        <p className="mt-3 text-center text-xs text-slate-400">
          {canMark ? "Tap a day to mark present. Tap a green day to undo." : "Green days are classes you attended."}
        </p>
      </section>

      {canMark && (student.guardianName || student.guardianPhone) && (
        <section className="card flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Guardian</p>
            <p className="font-medium text-slate-800">{student.guardianName || "—"}</p>
          </div>
          {student.guardianPhone && (
            <a href={`tel:${student.guardianPhone}`} className="btn-secondary px-3 py-2">
              <Phone size={16} /> {student.guardianPhone}
            </a>
          )}
        </section>
      )}

      <DiaryList
        studentId={student._id}
        studentName={student.fullName}
        refreshKey={diaryRefresh}
        title={isSelf ? "My diary" : "Diary"}
      />

      {exams.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Exam results</h2>
          <ul className="card divide-y divide-slate-100 p-0">
            {exams.map((ex) => (
              <li key={ex._id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-medium text-slate-800">{ex.examName}</span>
                  <span className="text-slate-500"> · {ex.subject}</span>
                </span>
                <span className="font-semibold text-slate-900">
                  {ex.obtainedMarks}/{ex.totalMarks}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {justMarked && (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg md:bottom-6">
          <span className="flex-1">Marked present · {formatDate(justMarked, { day: "numeric", month: "short" })}</span>
          <button
            onClick={() => {
              setDiaryForDate(justMarked);
              setJustMarked(null);
            }}
            className="flex items-center gap-1 font-semibold text-brand-200"
          >
            <BookOpen size={16} /> Add diary
          </button>
          <button onClick={() => setJustMarked(null)} aria-label="Dismiss" className="text-slate-400">
            <X size={16} />
          </button>
        </div>
      )}

      {diaryForDate && (
        <DiaryFormModal
          studentId={student._id}
          studentName={student.fullName}
          defaultDate={diaryForDate}
          onClose={() => setDiaryForDate(null)}
          onSaved={() => {
            setDiaryForDate(null);
            setDiaryRefresh((k) => k + 1);
          }}
        />
      )}

      {editing && (
        <StudentFormModal
          student={student}
          onClose={() => setEditing(false)}
          onSaved={(s) => {
            setEditing(false);
            setStudent({ ...student, ...s, teacher: student.teacher, user: student.user });
          }}
        />
      )}
    </div>
  );
}
