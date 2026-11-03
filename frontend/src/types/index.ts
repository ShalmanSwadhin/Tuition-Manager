export type StudentStatus = "active" | "paused" | "archived";

export interface Student {
  _id: string;
  fullName: string;
  photoUrl?: string;
  school?: string;
  classGrade: string;
  subjects: string[];
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  monthlyClassTarget: number;
  defaultClassDurationMinutes?: number;
  preferredDays?: string[];
  notes?: string;
  joiningDate: string;
  status: StudentStatus;
  color: string;
}

export type ClassStatus = "scheduled" | "completed" | "cancelled";

export interface ClassSession {
  _id: string;
  student: string | { _id: string; fullName: string; color: string };
  date: string;
  status: ClassStatus;
  note?: string;
  durationMinutes?: number;
}

export interface DiaryEntry {
  _id: string;
  student: string | { _id: string; fullName: string };
  date: string;
  subject: string;
  topic?: string;
  taughtToday?: string;
  homework?: string;
  nextPrep?: string;
  notes?: string;
  homeworkStatus: "pending" | "completed";
}

export interface ExamResult {
  _id: string;
  student: string;
  examName: string;
  subject: string;
  examDate: string;
  totalMarks: number;
  obtainedMarks: number;
  comments?: string;
}

export interface DashboardSummary {
  totals: {
    activeStudents: number;
    completedThisMonth: number;
    remainingThisMonth: number;
    studentsAtTarget: number;
  };
  todaysSchedule: ClassSession[];
  recentDiaryEntries: DiaryEntry[];
  approachingLimit: { id: string; fullName: string; completed: number; target: number }[];
  studentCards: {
    id: string;
    fullName: string;
    classGrade: string;
    color: string;
    monthlyClassTarget: number;
    completed: number;
  }[];
}
