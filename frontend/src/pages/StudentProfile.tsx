import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Eye, EyeOff } from "lucide-react";
import api from "../api/client";
import MonthCalendar, { CalendarDay } from "../components/MonthCalendar";
import DateActionModal from "../components/DateActionModal";
import QuickDiaryModal from "../components/QuickDiaryModal";
import DiaryHistory from "../components/DiaryHistory";
import { summarize } from "../utils/attendance";
import type { Student, ClassSession, ExamResult } from "../types";

function todayDhakaStr(): string {
  const d = new Date(Date.now() + 6 * 60 * 60000);
  return d.toISOString().slice(0, 10);
}

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const today = todayDhakaStr();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));

  // Day-action modal (mark completed / scheduled / cancelled / remove)
  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Quick diary modal: either opened explicitly via "Add Diary", or offered
  // automatically right after a class is marked completed, prefilled to
  // that date.
  const [diaryModalDate, setDiaryModalDate] = useState<string | null>(null);

  // Bumped whenever attendance or diary changes, so DiaryHistory (and the
  // small "recent diary" bits) know to refetch.
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0);

  // Quick on/off blur for the attendance summary + calendar, for moments
  // when a student can see the tutor's screen. Doesn't persist across
  // visits on purpose -- it always starts visible, so the tutor never
  // lands on a profile mid-session wondering why the numbers are hidden.
  const [privacyMode, setPrivacyMode] = useState(false);

  function loadStudent() {
    if (!id) return;
    api.get<Student>(`/students/${id}`).then((res) => setStudent(res.data));
  }
  function loadSessions() {
    if (!id) return;
    api.get<ClassSession[]>("/classes", { params: { student: id, month, year } }).then((res) => setSessions(res.data));
  }
  function loadExams() {
    if (!id) return;
    api.get<ExamResult[]>("/exams", { params: { student: id } }).then((res) => setExams(res.data));
  }

  useEffect(() => {
    loadStudent();
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, month, year]);

  const marks: Record<string, CalendarDay> = useMemo(() => {
    const m: Record<string, CalendarDay> = {};
    for (const s of sessions) {
      m[s.date] = { dateStr: s.date, status: s.status, label: s.note };
    }
    return m;
  }, [sessions]);

  const existingForActiveDate = activeDate ? sessions.find((s) => s.date === activeDate) || null : null;

  const completed = sessions.filter((s) => s.status === "completed").length;
  const target = student?.monthlyClassTarget || 0;
  const { remaining, progressPercent: progress } = summarize(target, completed);

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  function handleDateChanged(wasNewlyCompleted: boolean, dateStr: string) {
    setActiveDate(null);
    loadSessions();
    setDiaryRefreshKey((k) => k + 1);
    if (wasNewlyCompleted) {
      // Attendance is already saved at this point regardless of what the
      // tutor picks next -- the diary prompt is purely an offer, never a
      // requirement to complete the attendance action.
      if (confirm("Class marked completed. Would you like to add today's diary entry now?")) {
        setDiaryModalDate(dateStr);
      }
    }
  }

  if (!student) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <Link to="/students" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> Back to students
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{student.fullName}</h1>
          <p className="text-sm text-slate-500">
            {student.classGrade} {student.school ? `· ${student.school}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600">
            {student.status}
          </span>
          <button
            onClick={() => setPrivacyMode((v) => !v)}
            title={privacyMode ? "Show attendance" : "Hide attendance (e.g. if the student can see your screen)"}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden sm:inline">{privacyMode ? "Hidden" : "Hide attendance"}</span>
          </button>
          <button
            onClick={() => setDiaryModalDate(today)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <BookOpen size={16} /> Add Diary
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <div className={privacyMode ? "space-y-4 select-none blur-md pointer-events-none" : "space-y-4"}>
              {/* Compact monthly attendance summary, above the calendar */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-500">Monthly target: <strong className="text-slate-900">{target}</strong></span>
                  <span className="text-slate-500">Completed: <strong className="text-emerald-700">{completed}</strong></span>
                  <span className="text-slate-500">Remaining: <strong className="text-slate-900">{remaining}</strong></span>
                  <span className="text-slate-500">Progress: <strong className="text-slate-900">{progress}%</strong></span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-brand-500" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                {completed >= target && target > 0 && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">Monthly target reached 🎉</p>
                )}
              </div>

              <MonthCalendar
                year={year}
                month={month}
                todayStr={today}
                marks={marks}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onDayClick={(dateStr) => setActiveDate(dateStr)}
                colorMode="status"
                showLegend
              />
              <p className="text-xs text-slate-400">Tap a date to mark it completed, scheduled, or cancelled.</p>
            </div>

            {privacyMode && (
              <button
                onClick={() => setPrivacyMode(false)}
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/30"
              >
                <span className="flex items-center gap-2 rounded-full bg-slate-900/85 px-4 py-2 text-sm font-medium text-white shadow-lg">
                  <Eye size={16} /> Tap to reveal
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Guardian</h2>
            <p className="text-sm text-slate-600">{student.guardianName || "—"}</p>
            <p className="text-sm text-slate-500">{student.guardianPhone || "—"}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Exam history</h2>
            {exams.length === 0 ? (
              <p className="text-xs text-slate-400">No exam records yet.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {exams.map((ex) => (
                    <tr key={ex._id} className="border-t border-slate-100">
                      <td className="py-1 text-slate-600">{ex.examName}</td>
                      <td className="py-1 text-right font-medium text-slate-900">
                        {ex.obtainedMarks}/{ex.totalMarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <DiaryHistory studentId={student._id} studentName={student.fullName} refreshKey={diaryRefreshKey} />

      {activeDate && (
        <DateActionModal
          studentId={student._id}
          dateStr={activeDate}
          existing={existingForActiveDate}
          onClose={() => setActiveDate(null)}
          onChanged={(wasNewlyCompleted) => handleDateChanged(wasNewlyCompleted, activeDate)}
        />
      )}

      {diaryModalDate && (
        <QuickDiaryModal
          student={{ id: student._id, fullName: student.fullName }}
          defaultDate={diaryModalDate}
          onClose={() => setDiaryModalDate(null)}
          onSaved={() => {
            setDiaryModalDate(null);
            setDiaryRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
