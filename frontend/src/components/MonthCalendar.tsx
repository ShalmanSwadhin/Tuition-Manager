import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { monthLabel } from "../utils/date";

export interface CalendarMark {
  color?: string; // fill color; defaults to green
  count?: number; // >1 shows a small badge (global calendar: several students that day)
}

interface Props {
  year: number;
  month: number; // 1-12
  todayStr: string;
  marks: Record<string, CalendarMark>; // keyed by YYYY-MM-DD; a key present = present that day
  onPrevMonth: () => void;
  onNextMonth: () => void;
  // When set, past and today's cells are tappable; future cells never are.
  onDayClick?: (dateStr: string) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MonthCalendar({ year, month, todayStr, marks, onPrevMonth, onNextMonth, onDayClick }: Props) {
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onPrevMonth} className="rounded-full p-2 hover:bg-slate-100" aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm font-semibold text-slate-900">{monthLabel(year, month)}</p>
        <button onClick={onNextMonth} className="rounded-full p-2 hover:bg-slate-100" aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-400">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
          const mark = marks[dateStr];
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const clickable = Boolean(onDayClick) && !isFuture;
          const day = Number(dateStr.slice(8, 10));

          return (
            <button
              key={dateStr}
              disabled={!clickable}
              onClick={() => onDayClick?.(dateStr)}
              style={mark ? { background: mark.color || "#10b981" } : undefined}
              aria-label={`${dateStr}${mark ? ", present" : ""}`}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold transition ${
                mark
                  ? "text-white shadow-sm"
                  : isFuture
                    ? "text-slate-300"
                    : clickable
                      ? "bg-slate-50 text-slate-700 active:bg-slate-200"
                      : "bg-slate-50 text-slate-600"
              } ${isToday ? "ring-2 ring-brand-500 ring-offset-1" : ""} ${clickable ? "active:scale-95" : ""}`}
            >
              {day}
              {mark && (mark.count ?? 1) <= 1 && <Check size={12} strokeWidth={3} className="opacity-90" />}
              {mark && (mark.count ?? 1) > 1 && <span className="text-[10px] font-bold leading-none">×{mark.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
