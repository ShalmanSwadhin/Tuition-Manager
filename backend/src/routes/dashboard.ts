import { Router } from "express";
import Student from "../models/Student";
import ClassSession from "../models/ClassSession";
import DiaryEntry from "../models/DiaryEntry";
import User from "../models/User";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { monthBounds, todayDhakaStr, nowInDhaka } from "../utils/dateUtils";
import { studentScope } from "../utils/access";

const router = Router();
router.use(requireAuth, requireRole("admin", "teacher"));

router.get("/summary", async (req: AuthedRequest, res) => {
  const today = todayDhakaStr();
  const now = nowInDhaka();
  const { start, end } = monthBounds(now.getUTCFullYear(), now.getUTCMonth() + 1);

  const students = await Student.find({ ...studentScope(req.user!), status: "active" })
    .sort({ fullName: 1 })
    .populate("teacher", "name");
  const studentIds = students.map((s) => s._id);

  const monthSessions = await ClassSession.find({
    student: { $in: studentIds },
    date: { $gte: start, $lte: end },
    status: "completed",
  });

  const completedByStudent = new Map<string, number>();
  const presentToday = new Set<string>();
  for (const s of monthSessions) {
    const key = s.student.toString();
    completedByStudent.set(key, (completedByStudent.get(key) || 0) + 1);
    if (s.date === today) presentToday.add(key);
  }

  const completedThisMonth = monthSessions.length;
  const targetTotal = students.reduce((sum, s) => sum + s.monthlyClassTarget, 0);
  const studentsAtTarget = students.filter(
    (s) => (completedByStudent.get(s._id.toString()) || 0) >= s.monthlyClassTarget
  ).length;

  const recentDiary = await DiaryEntry.find({ student: { $in: studentIds } })
    .sort({ updatedAt: -1 })
    .limit(5)
    .populate("student", "fullName");

  const studentCards = students.map((s) => ({
    id: s._id,
    fullName: s.fullName,
    classGrade: s.classGrade,
    color: s.color,
    monthlyClassTarget: s.monthlyClassTarget,
    completed: completedByStudent.get(s._id.toString()) || 0,
    presentToday: presentToday.has(s._id.toString()),
    hasAccount: Boolean(s.user),
    teacherName: (s.teacher as any)?.name,
  }));

  res.json({
    today,
    totals: {
      activeStudents: students.length,
      completedThisMonth,
      remainingThisMonth: Math.max(targetTotal - completedThisMonth, 0),
      studentsAtTarget,
      presentToday: presentToday.size,
      teachers: req.user!.role === "admin" ? await User.countDocuments({ role: "teacher" }) : undefined,
    },
    recentDiaryEntries: recentDiary,
    studentCards,
  });
});

export default router;
