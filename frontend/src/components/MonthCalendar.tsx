import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

export interface CalendarDay {
  dateStr: string;
  status?: "completed" | "scheduled" | "cancelled";
  color?: string;
  label?: string;
}

interface Props {
  year: number;
  month: number; // 1-12
  todayStr: string;
  marks: Record<string, CalendarDay>; // keyed by YYYY-MM-DD
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (dateStr: string) => void;
  // "status": subtle green/blue/grey by status — used for a single student's
  // own calendar, where there's nothing to tell apart by color.
  // "student": the existing per-student color-coded look, used on the
  // global calendar where distinguishing students matters more than status.
  colorMode?: "status" | "student";
  showLegend?: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Scheduled
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Cancelled
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full ring-2 ring-brand-500" /> Today
      </span>
    </div>
  );
}

export default function MonthCalendar({
  year,
  month,
  todayStr,
  marks,
  onPrevMonth,
  onNextMonth,
  onDayClick,
  colorMode = "student",
  showLegend = false,
}: Props) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const monthLabel = firstOfMonth.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onPrevMonth} className="rounded p-1 hover:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
        <button onClick={onNextMonth} className="rounded p-1 hover:bg-slate-100">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
          const mark = marks[dateStr];
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;

          let bg = "bg-white hover:bg-slate-50";
          let text = "text-slate-700";
          let style: CSSProperties | undefined;

          if (colorMode === "status") {
            // Subtle, status-only indicators for a single student's calendar.
            if (mark?.status === "completed") {
              bg = "bg-emerald-50 hover:bg-emerald-100 ring-1 ring-inset ring-emerald-200";
              text = "text-emerald-700";
            } else if (mark?.status === "scheduled") {
              bg = "bg-blue-50 hover:bg-blue-100 ring-1 ring-inset ring-blue-200";
              text = "text-blue-700";
            } else if (mark?.status === "cancelled") {
              bg = "bg-slate-100";
              text = "text-slate-400 line-through";
            } else if (isFuture) {
              text = "text-slate-400";
            }
          } else {
            // Per-student color coding for the global calendar.
            if (mark?.status === "completed") {
              bg = "text-white";
              text = "text-white";
              style = { background: mark.color || "#6366f1" };
            } else if (mark?.status === "scheduled") {
              bg = "bg-blue-50 hover:bg-blue-100";
              text = "text-blue-700";
            } else if (mark?.status === "cancelled") {
              bg = "bg-slate-100";
              text = "text-slate-400 line-through";
            } else if (isFuture) {
              text = "text-slate-400";
            }
          }

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              style={style}
              className={`relative aspect-square rounded-lg text-xs font-medium ${bg} ${text} ${
                isToday ? "ring-2 ring-brand-500" : ""
              }`}
              title={mark?.label}
            >
              {Number(dateStr.slice(8, 10))}
            </button>
          );
        })}
      </div>
      {showLegend && <Legend />}
    </div>
  );
}
