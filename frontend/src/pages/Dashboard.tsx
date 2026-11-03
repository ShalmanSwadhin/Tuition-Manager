import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, CheckCircle2, Clock, Target, AlertCircle, BookOpen } from "lucide-react";
import api from "../api/client";
import QuickDiaryModal from "../components/QuickDiaryModal";
import { summarize } from "../utils/attendance";
import type { DashboardSummary } from "../types";

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon size={18} className="text-brand-500" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiaryModal, setShowDiaryModal] = useState(false);

  function load() {
    api
      .get<DashboardSummary>("/dashboard/summary")
      .then((res) => setData(res.data))
      .catch(() => setError("Couldn't load the dashboard. Try refreshing."));
  }

  useEffect(load, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <button
          onClick={() => setShowDiaryModal(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <BookOpen size={16} /> Quick diary entry
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Active students" value={data.totals.activeStudents} icon={Users} />
        <SummaryCard label="Completed this month" value={data.totals.completedThisMonth} icon={CheckCircle2} />
        <SummaryCard label="Remaining this month" value={data.totals.remainingThisMonth} icon={Clock} />
        <SummaryCard label="At monthly target" value={data.totals.studentsAtTarget} icon={Target} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Today's schedule</h2>
          {data.todaysSchedule.length === 0 ? (
            <p className="text-sm text-slate-400">No classes recorded for today yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.todaysSchedule.map((s) => {
                const student = typeof s.student === "object" ? s.student : null;
                return (
                  <li key={s._id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: student?.color || "#6366f1" }} />
                      {student?.fullName || "Student"}
                    </span>
                    <span className="capitalize text-slate-400">{s.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recently updated diaries</h2>
          {data.recentDiaryEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No diary entries yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentDiaryEntries.map((d) => {
                const student = typeof d.student === "object" ? d.student : null;
                return (
                  <li key={d._id} className="text-sm">
                    <span className="font-medium text-slate-700">{student?.fullName}</span>{" "}
                    <span className="text-slate-400">— {d.subject} · {d.date}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {data.approachingLimit.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertCircle size={16} /> Approaching monthly target
          </h2>
          <ul className="space-y-1 text-sm text-amber-800">
            {data.approachingLimit.map((s) => (
              <li key={s.id}>
                {s.fullName}: {s.completed}/{s.target}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Students</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.studentCards.map((s) => {
            const pct = Math.min(summarize(s.monthlyClassTarget, s.completed).progressPercent, 100);
            return (
              <Link
                key={s.id}
                to={`/students/${s.id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <p className="truncate text-sm font-medium text-slate-900">{s.fullName}</p>
                </div>
                <p className="mb-2 text-xs text-slate-400">{s.classGrade}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {s.completed}/{s.monthlyClassTarget} classes
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {showDiaryModal && (
        <QuickDiaryModal
          students={data.studentCards.map((s) => ({ _id: s.id, fullName: s.fullName }))}
          onClose={() => setShowDiaryModal(false)}
          onSaved={() => {
            setShowDiaryModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
