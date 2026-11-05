import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import MonthCalendar, { CalendarMark } from "../components/MonthCalendar";
import { todayDhakaStr, formatDate, shiftMonth } from "../utils/date";
import type { ClassSession, Student } from "../types";

export default function GlobalCalendar() {
  const today = todayDhakaStr();
  const [ym, setYm] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filterStudent, setFilterStudent] = useState("");

  useEffect(() => {
    api.get<Student[]>("/students", { params: { status: "active" } }).then((res) => setStudents(res.data));
  }, []);

  useEffect(() => {
    api
      .get<ClassSession[]>("/classes", { params: { month: ym.month, year: ym.year, student: filterStudent || undefined } })
      .then((res) => setSessions(res.data.filter((s) => s.status === "completed")));
  }, [ym, filterStudent]);

  const byDate = useMemo(() => {
    const m: Record<string, ClassSession[]> = {};
    for (const s of sessions) (m[s.date] ||= []).push(s);
    return m;
  }, [sessions]);

  // One student that day: their color. Several: brand color with a count.
  const marks = useMemo(() => {
    const m: Record<string, CalendarMark> = {};
    for (const [date, list] of Object.entries(byDate)) {
      const only = list.length === 1 && typeof list[0].student === "object" ? list[0].student : null;
      m[date] = { color: only ? only.color : "#4f46e5", count: list.length };
    }
    return m;
  }, [byDate]);

  return (
    <div className="space-y-4">
      <h1 className="page-title">Calendar</h1>
      <select value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)} className="input">
        <option value="">All students</option>
        {students.map((s) => (
          <option key={s._id} value={s._id}>
            {s.fullName}
          </option>
        ))}
      </select>

      <div className="card">
        <MonthCalendar
          year={ym.year}
          month={ym.month}
          todayStr={today}
          marks={marks}
          onPrevMonth={() => setYm(shiftMonth(ym.year, ym.month, -1))}
          onNextMonth={() => setYm(shiftMonth(ym.year, ym.month, 1))}
        />
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-900">Classes this month</h2>
        {Object.keys(byDate).length === 0 ? (
          <p className="card text-center text-sm text-slate-500">No classes marked this month.</p>
        ) : (
          <ul className="card divide-y divide-slate-100 p-0">
            {Object.entries(byDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, list]) => (
                <li key={date} className="px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">{formatDate(date, { weekday: "short", day: "numeric", month: "short" })}</p>
                  <div className="flex flex-wrap gap-2">
                    {list.map((s) => {
                      const st = typeof s.student === "object" ? s.student : null;
                      return (
                        <Link
                          key={s._id}
                          to={`/students/${st?._id}`}
                          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: st?.color }} />
                          {st?.fullName}
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
