import { Router } from "express";
import Student from "../models/Student";
import ClassSession from "../models/ClassSession";
import DiaryEntry from "../models/DiaryEntry";
import { requireAuth } from "../middleware/auth";
import { monthBounds } from "../utils/dateUtils";
import { summarize, countCompleted } from "../utils/attendance";

const router = Router();
router.use(requireAuth);

// GET /api/reports/monthly?year=2026&month=9
router.get("/monthly", async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: "year and month (1-12) are required" });
  }
  const { start, end } = monthBounds(year, month);

  const students = await Student.find({ status: { $ne: "archived" } }).sort({ fullName: 1 });
  const report = [];

  for (const s of students) {
    const sessions = await ClassSession.find({ student: s._id, date: { $gte: start, $lte: end } });
    const completed = countCompleted(sessions);
    const cancelled = sessions.filter((c) => c.status === "cancelled").length;
    const summary = summarize(s.monthlyClassTarget, completed);
    const diaryCount = await DiaryEntry.countDocuments({ student: s._id, date: { $gte: start, $lte: end } });
    const homeworkCompleted = await DiaryEntry.countDocuments({
      student: s._id,
      date: { $gte: start, $lte: end },
      homeworkStatus: "completed",
    });

    report.push({
      studentId: s._id,
      fullName: s.fullName,
      monthlyClassTarget: s.monthlyClassTarget,
      completed,
      cancelled,
      remaining: summary.remaining,
      completionPercent: summary.progressPercent,
      diaryEntries: diaryCount,
      homeworkCompleted,
      homeworkTotal: diaryCount,
    });
  }

  const overall = {
    totalTarget: report.reduce((sum, r) => sum + r.monthlyClassTarget, 0),
    totalCompleted: report.reduce((sum, r) => sum + r.completed, 0),
  };

  res.json({ year, month, students: report, overall });
});

export default router;
