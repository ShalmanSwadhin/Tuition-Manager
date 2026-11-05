import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { todayDhakaStr, monthLabel, shiftMonth } from "../utils/date";

interface ReportRow {
  studentId: string;
  fullName: string;
  teacherName?: string;
  monthlyClassTarget: number;
  completed: number;
  remaining: number;
  completionPercent: number;
  diaryEntries: number;
  homeworkCompleted: number;
  homeworkTotal: number;
}

export default function Reports() {
  const { user } = useAuth();
  const today = todayDhakaStr();
  const [ym, setYm] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [overall, setOverall] = useState<{ totalTarget: number; totalCompleted: number } | null>(null);

  useEffect(() => {
    setRows(null);
    api.get("/reports/monthly", { params: ym }).then((res) => {
      setRows(res.data.students);
      setOverall(res.data.overall);
    });
  }, [ym]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Reports</h1>
        <button onClick={() => window.print()} className="btn-secondary px-3 py-2 print:hidden">
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="card flex items-center justify-between p-2 print:hidden">
        <button onClick={() => setYm(shiftMonth(ym.year, ym.month, -1))} className="rounded-full p-2 hover:bg-slate-100" aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <p className="font-semibold text-slate-900">{monthLabel(ym.year, ym.month)}</p>
        <button onClick={() => setYm(shiftMonth(ym.year, ym.month, 1))} className="rounded-full p-2 hover:bg-slate-100" aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>
      <p className="hidden text-lg font-semibold print:block">{monthLabel(ym.year, ym.month)}</p>

      {overall && (
        <div className="card">
          <p className="text-sm text-slate-500">All students</p>
          <p className="text-2xl font-bold text-slate-900">
            {overall.totalCompleted}
            <span className="text-base font-medium text-slate-400"> / {overall.totalTarget} classes</span>
          </p>
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">No students for this month.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.studentId} className="card break-inside-avoid">
              <div className="flex items-baseline justify-between gap-2">
                <Link to={`/students/${r.studentId}`} className="truncate font-semibold text-slate-900">
                  {r.fullName}
                </Link>
                <span className="shrink-0 text-sm font-semibold text-slate-700">{r.completionPercent}%</span>
              </div>
              {user?.role === "admin" && r.teacherName && <p className="text-xs text-slate-500">Teacher: {r.teacherName}</p>}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(r.completionPercent, 100)}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <dt className="text-slate-500">Present</dt>
                  <dd className="text-base font-semibold text-slate-900">
                    {r.completed}/{r.monthlyClassTarget}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Diary</dt>
                  <dd className="text-base font-semibold text-slate-900">{r.diaryEntries}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Homework</dt>
                  <dd className="text-base font-semibold text-slate-900">
                    {r.homeworkCompleted}/{r.homeworkTotal}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
