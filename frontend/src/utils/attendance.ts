export interface AttendanceSummary {
  target: number;
  completed: number;
  remaining: number;
  progressPercent: number;
}

export function summarize(target: number, completed: number): AttendanceSummary {
  const remaining = Math.max(target - completed, 0);
  const progressPercent = target > 0 ? Math.round((completed / target) * 1000) / 10 : 0;
  return { target, completed, remaining, progressPercent };
}
