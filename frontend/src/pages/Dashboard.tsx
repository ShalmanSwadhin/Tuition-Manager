import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CalendarDays, ChevronRight, UserPlus } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import TeacherKeyCard from "../components/TeacherKeyCard";
import NoticeBoard from "../components/NoticeBoard";
import { formatDate } from "../utils/date";
import { summarize } from "../utils/attendance";
import type { DashboardSummary, StudentCard } from "../types";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-3">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    api
      .get<DashboardSummary>("/dashboard/summary")
      .then((res) => setData(res.data))
      .catch(() => setError("Couldn't load your dashboard. Try refreshing the page."));
  }
  useEffect(load, []);

  async function togglePresent(card: StudentCard) {
    if (!data) return;
    if (card.presentToday && !confirm(`Remove today's present mark for ${card.fullName}?`)) return;
    setBusy(card.id);
    try {
      const res = await api.post<{ present: boolean }>("/classes/toggle", { student: card.id, date: data.today });
      const delta = res.data.present === card.presentToday ? 0 : res.data.present ? 1 : -1;
      setData({
        ...data,
        totals: {
          ...data.totals,
          presentToday: data.totals.presentToday + delta,
          completedThisMonth: data.totals.completedThisMonth + delta,
        },
        studentCards: data.studentCards.map((c) =>
          c.id === card.id ? { ...c, presentToday: res.data.present, completed: c.completed + delta } : c
        ),
      });
    } catch (err: any) {
      alert(err?.response?.data?.error || "Couldn't update attendance");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data || !user) return <p className="text-sm text-slate-400">Loading…</p>;

  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">{formatDate(data.today, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="page-title">Hi, {user.name.split(" ")[0]}</h1>
      </div>

      {user.role === "teacher" && <TeacherKeyCard />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isAdmin && <Stat label="Teachers" value={data.totals.teachers ?? 0} />}
        <Stat label="Active students" value={data.totals.activeStudents} />
        <Stat label="Present today" value={data.totals.presentToday} />
        <Stat label="Classes this month" value={data.totals.completedThisMonth} />
        {!isAdmin && <Stat label="Reached target" value={data.totals.studentsAtTarget} />}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Today's attendance</h2>
          <Link to="/calendar" className="flex items-center gap-1 text-sm font-medium text-brand-600">
            <CalendarDays size={16} /> Calendar
          </Link>
        </div>

        {data.studentCards.length === 0 ? (
          <div className="card text-center">
            <UserPlus className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">
              {isAdmin ? "No students yet." : "No students yet. Share your teacher key above so students can join."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.studentCards.map((c) => {
              const pct = Math.min(summarize(c.monthlyClassTarget, c.completed).progressPercent, 100);
              return (
                <li key={c.id} className="card flex items-center gap-3 p-3">
                  <Link to={`/students/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: c.color }}
                    >
                      {c.fullName.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{c.fullName}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {c.completed}/{c.monthlyClassTarget} this month{isAdmin && c.teacherName ? ` · ${c.teacherName}` : ""}
                      </span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                  </Link>
                  <button
                    onClick={() => togglePresent(c)}
                    disabled={busy === c.id}
                    className={`btn shrink-0 px-3 py-2 ${
                      c.presentToday ? "bg-emerald-500 text-white" : "border border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {c.presentToday ? <Check size={16} strokeWidth={3} /> : null}
                    {c.presentToday ? "Present" : "Mark"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {user.role === "teacher" && <NoticeBoard limit={2} />}

      {data.recentDiaryEntries.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Recent diary activity</h2>
          <ul className="card divide-y divide-slate-100 p-0">
            {data.recentDiaryEntries.map((d) => {
              const student = typeof d.student === "object" ? d.student : null;
              return (
                <li key={d._id}>
                  <Link to={student ? `/students/${student._id}` : "/diary"} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {student?.fullName} · {d.subject}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatDate(d.date)}
                        {d.author?.role === "student" ? " · written by student" : ""}
                        {d.history?.length ? " · edited" : ""}
                      </span>
                    </span>
                    <ChevronRight size={18} className="text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
