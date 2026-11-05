export type Role = "admin" | "teacher" | "student";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  teacherKey?: string; // teachers
  studentId?: string; // students: their own profile id
  teacherName?: string; // students
}

export type StudentStatus = "active" | "paused" | "archived";
export type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

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
  preferredDays?: Weekday[];
  classTime?: string; // "HH:MM"
  notes?: string;
  joiningDate: string;
  status: StudentStatus;
  color: string;
  teacher?: string | { _id: string; name: string };
  user?: string | { _id: string; email: string };
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

export interface DiaryActor {
  user: string;
  name: string;
  role: Role;
}

export interface DiaryContent {
  date: string;
  subject: string;
  topic?: string;
  taughtToday?: string;
  homework?: string;
  nextPrep?: string;
  notes?: string;
}

export interface DiaryVersion extends DiaryContent {
  editedAt: string;
  editedBy: DiaryActor;
}

export interface DiaryEntry extends DiaryContent {
  _id: string;
  student: string | { _id: string; fullName: string; guardianPhone?: string };
  homeworkStatus: "pending" | "completed";
  author?: DiaryActor;
  history: DiaryVersion[];
  createdAt: string;
  updatedAt: string;
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

export interface StudentCard {
  id: string;
  fullName: string;
  classGrade: string;
  color: string;
  monthlyClassTarget: number;
  completed: number;
  presentToday: boolean;
  hasAccount: boolean;
  teacherName?: string;
}

export interface DashboardSummary {
  today: string;
  totals: {
    activeStudents: number;
    completedThisMonth: number;
    remainingThisMonth: number;
    studentsAtTarget: number;
    presentToday: number;
    teachers?: number;
  };
  recentDiaryEntries: DiaryEntry[];
  studentCards: StudentCard[];
}

export interface StudentFile {
  _id: string;
  student: string;
  uploadedBy?: { _id: string; name: string };
  filename: string;
  contentType: string;
  size: number;
  note?: string;
  createdAt: string;
}

export interface Notice {
  _id: string;
  teacher: string | { _id: string; name: string };
  title: string;
  body?: string;
  createdAt: string;
}

export interface TeacherSummary {
  id: string;
  name: string;
  email: string;
  teacherKey: string;
  createdAt: string;
  studentCount: number;
}
