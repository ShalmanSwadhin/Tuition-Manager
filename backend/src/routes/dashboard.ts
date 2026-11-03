import { Router } from "express";
import Student from "../models/Student";
import ClassSession from "../models/ClassSession";
import DiaryEntry from "../models/DiaryEntry";
import { requireAuth } from "../middleware/auth";
import { monthBounds, todayDhakaStr, nowInDhaka } from "../utils/dateUtils";
import { summarize } from "../utils/attendance";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (_req, res) => {
  const today = todayDhakaStr();
  const now = nowInDhaka();
  const { start, end } = monthBounds(now.getUTCFullYear(), now.getUTCMonth() + 1);

  const students = await Student.find({ status: "active" });
  const studentIds = students.map((s) => s._id);

  const monthSessions = await ClassSession.find({
    student: { $in: studentIds },
    date: { $gte: start, $lte: end },
  });

  const completedByStudent = new Map<string, number>();
  let completedThisMonth = 0;
  for (const s of monthSessions) {
    if (s.status === "completed") {
      completedThisMonth += 1;
      const key = s.student.toString();
      completedByStudent.set(key, (completedByStudent.get(key) || 0) + 1);
    }
  }

  const targetTotal = students.reduce((sum, s) => sum + s.monthlyClassTarget, 0);
  const remainingThisMonth = Math.max(targetTotal - completedThisMonth, 0);

  const todaysSessions = await ClassSession.find({ date: today, status: { $ne: "cancelled" } }).populate(
    "student",
    "fullName color"
  );

  const studentsAtTarget = students.filter(
    (s) => (completedByStudent.get(s._id.toString()) || 0) >= s.monthlyClassTarget
  ).length;

  const approachingLimit = students
    .filter((s) => {
      const done = completedByStudent.get(s._id.toString()) || 0;
      return done < s.monthlyClassTarget && done >= s.monthlyClassTarget - 2;
    })
    .map((s) => ({
      id: s._id,
      fullName: s.fullName,
      completed: completedByStudent.get(s._id.toString()) || 0,
      target: s.monthlyClassTarget,
    }));

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
  }));

  res.json({
    totals: {
      activeStudents: students.length,
      completedThisMonth,
      remainingThisMonth,
      studentsAtTarget,
    },
    todaysSchedule: todaysSessions,
    recentDiaryEntries: recentDiary,
    approachingLimit,
    studentCards,
  });
});

export default router;
