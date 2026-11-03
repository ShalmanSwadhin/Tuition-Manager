import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import MonthCalendar from "../components/MonthCalendar";
import type { ClassSession, Student } from "../types";

function todayDhakaStr(): string {
  const d = new Date(Date.now() + 6 * 60 * 60000);
  return d.toISOString().slice(0, 10);
}

export default function GlobalCalendar() {
  const today = todayDhakaStr();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filterStudent, setFilterStudent] = useState<string>("");

  useEffect(() => {
    api.get<Student[]>("/students", { params: { status: "active" } }).then((res) => setStudents(res.data));
  }, []);

  useEffect(() => {
    api.get<ClassSession[]>("/classes", { params: { month, year, student: filterStudent || undefined } }).then((res) =>
      setSessions(res.data)
    );
  }, [month, year, filterStudent]);

  // Group sessions by date for a readable agenda list, since a single
  // calendar cell can only show one color at a time.
  const byDate = useMemo(() => {
    const m: Record<string, ClassSession[]> = {};
    for (const s of sessions) {
      if (!m[s.date]) m[s.date] = [];
      m[s.date].push(s);
    }
    return m;
  }, [sessions]);

  const marks = useMemo(() => {
    const m: Record<string, { dateStr: string; status?: any; color?: string }> = {};
    for (const date of Object.keys(byDate)) {
      const daySessions = byDate[date];
      const completedCount = daySessions.filter((s) => s.status === "completed").length;
      m[date] = {
        dateStr: date,
        status: completedCount > 0 ? "completed" : daySessions[0].status,
        color: completedCount > 1 ? "#6366f1" : (daySessions[0].student as any)?.color,
      };
    }
    return m;
  }, [byDate]);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Global calendar</h1>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthCalendar
            year={year}
            month={month}
            todayStr={today}
            marks={marks}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onDayClick={() => {}}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            {students.map((s) => (
              <span key={s._id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.fullName}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Agenda</h2>
          {Object.keys(byDate).length === 0 ? (
            <p className="text-xs text-slate-400">No classes recorded this month.</p>
          ) : (
            <ul className="space-y-3">
              {Object.entries(byDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, list]) => (
                  <li key={date}>
                    <p className="text-xs font-medium text-slate-500">{date}</p>
                    <ul className="ml-2 mt-1 space-y-1">
                      {list.map((s) => {
                        const student = typeof s.student === "object" ? s.student : null;
                        return (
                          <li key={s._id} className="flex items-center justify-between text-sm">
                            <Link to={`/students/${student?._id}`} className="flex items-center gap-2 hover:underline">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: student?.color }} />
                              {student?.fullName}
                            </Link>
                            <span className="text-xs capitalize text-slate-400">{s.status}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
