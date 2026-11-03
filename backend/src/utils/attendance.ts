// Pure, backend-authoritative attendance math. The frontend never computes
// these numbers itself — it only displays what this (or the API endpoints
// that call it) returns, per "never trust frontend calculations" in the spec.

export interface AttendanceSummary {
  target: number;
  completed: number;
  remaining: number;
  progressPercent: number; // one decimal place, can exceed 100
}

export function summarize(target: number, completed: number): AttendanceSummary {
  const remaining = Math.max(target - completed, 0);
  const progressPercent = target > 0 ? Math.round((completed / target) * 1000) / 10 : 0;
  return { target, completed, remaining, progressPercent };
}

// Only "completed" status counts toward the monthly target. Scheduled and
// cancelled records are excluded, regardless of how many of each exist.
export function countCompleted(sessions: { status: string }[]): number {
  return sessions.filter((s) => s.status === "completed").length;
}
