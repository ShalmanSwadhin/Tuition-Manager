import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import api from "../api/client";

interface ReportRow {
  studentId: string;
  fullName: string;
  monthlyClassTarget: number;
  completed: number;
  cancelled: number;
  remaining: number;
  completionPercent: number;
  diaryEntries: number;
  homeworkCompleted: number;
  homeworkTotal: number;
}

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [overall, setOverall] = useState<{ totalTarget: number; totalCompleted: number } | null>(null);

  useEffect(() => {
    api.get("/reports/monthly", { params: { year, month } }).then((res) => {
      setRows(res.data.students);
      setOverall(res.data.overall);
    });
  }, [year, month]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-lg font-semibold text-slate-900">Monthly reports</h1>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {overall && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          Overall: {overall.totalCompleted}/{overall.totalTarget} classes completed across all students.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Completed</th>
              <th className="px-4 py-2">Cancelled</th>
              <th className="px-4 py-2">Remaining</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2">Diary entries</th>
              <th className="px-4 py-2">Homework done</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">{r.fullName}</td>
                <td className="px-4 py-2">{r.monthlyClassTarget}</td>
                <td className="px-4 py-2">{r.completed}</td>
                <td className="px-4 py-2">{r.cancelled}</td>
                <td className="px-4 py-2">{r.remaining}</td>
                <td className="px-4 py-2">{r.completionPercent}%</td>
                <td className="px-4 py-2">{r.diaryEntries}</td>
                <td className="px-4 py-2">
                  {r.homeworkCompleted}/{r.homeworkTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
